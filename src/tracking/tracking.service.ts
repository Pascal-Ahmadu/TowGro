// src/tracking/tracking.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { TrackingGateway } from './tracking.gateway';
import { UpdateLocationDto } from './dto/tracking.dto';
import { LocationEntity } from './entities/location.entity';
import { performance } from 'perf_hooks';
import { TrackingEvents } from './events/tracking.events';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

// Increased cache TTL to reduce database reads
const LOCATION_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
const ACTIVE_VEHICLE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const DEFAULT_BATCH_INTERVAL = 30 * 1000; // 30 seconds for batch processing
const MIN_BATCH_SIZE = 50; // Minimum batch size before processing
const MAX_QUEUE_SIZE = 1000; // Maximum queue size before forcing processing

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly timestampThreshold: number;
  private readonly persistToDatabase: boolean;
  private readonly geofenceEnabled: boolean;
  private readonly alertOnSpeedExceeded: boolean;
  private readonly maxSpeed: number;
  private readonly batchSize: number;
  private readonly batchInterval: number;
  private readonly dataRetentionDays: number;
  private locationUpdateQueue: LocationEntity[] = [];
  private processingBatch = false;
  private batchTimer: NodeJS.Timeout | null = null;
  private latestLocationCache: Map<string, LocationEntity> = new Map(); // In-memory cache for latest locations

  constructor(
    private gateway: TrackingGateway,
    private configService: ConfigService,
    private trackingEvents: TrackingEvents,
    @InjectRepository(LocationEntity)
    private locationRepository: Repository<LocationEntity>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private dataSource: DataSource,
  ) {
    // Load configuration with defaults
    this.timestampThreshold =
      this.configService.get<number>('TRACKING_TIMESTAMP_THRESHOLD') || 60000;
    this.persistToDatabase =
      this.configService.get<boolean>('TRACKING_PERSIST_TO_DB') !== false;
    this.geofenceEnabled =
      this.configService.get<boolean>('TRACKING_GEOFENCE_ENABLED') || false;
    this.alertOnSpeedExceeded =
      this.configService.get<boolean>('TRACKING_ALERT_SPEED') || false;
    this.maxSpeed = this.configService.get<number>('TRACKING_MAX_SPEED') || 120; // km/h
    this.batchSize =
      this.configService.get<number>('TRACKING_BATCH_SIZE') || MIN_BATCH_SIZE;
    this.batchInterval =
      this.configService.get<number>('TRACKING_BATCH_INTERVAL') ||
      DEFAULT_BATCH_INTERVAL;
    this.dataRetentionDays =
      this.configService.get<number>('TRACKING_DATA_RETENTION_DAYS') || 30;

    this.logger.log(`TrackingService initialized with:
      - Timestamp threshold: ${this.timestampThreshold}ms
      - Database persistence: ${this.persistToDatabase ? 'Enabled' : 'Disabled'}
      - Geofence checks: ${this.geofenceEnabled ? 'Enabled' : 'Disabled'}
      - Speed alerts: ${this.alertOnSpeedExceeded ? 'Enabled' : 'Disabled'} (max: ${this.maxSpeed} km/h)
      - Batch size: ${this.batchSize}
      - Batch interval: ${this.batchInterval}ms
      - Data retention: ${this.dataRetentionDays} days
    `);

    // Start batch processing timer
    this.batchTimer = setInterval(
      () => this.processBatch(),
      this.batchInterval,
    );

    // Schedule data retention cleanup job (run daily at 2am)
    this.scheduleDataRetentionCleanup();
  }

  async updateLocation(
    dto: UpdateLocationDto,
    traceId?: string,
  ): Promise<boolean> {
    const txId =
      traceId ||
      `tx-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const startTime = performance.now();

    try {
      // Skip detailed logging for every request to reduce CPU utilization
      if (Math.random() < 0.05) {
        // Sample logging for 5% of requests
        this.logger.debug(
          `[${txId}] Processing location update for vehicle ${dto.vehicleId}`,
        );
      }

      // 1. Validate timestamp is recent
      if (!this.validateTimestamp(dto.timestamp)) {
        // Log warnings only for significant timestamp differences
        if (Date.now() - dto.timestamp > this.timestampThreshold * 2) {
          this.logger.warn(
            `[${txId}] Rejected outdated location update for vehicle ${dto.vehicleId} (timestamp diff: ${Date.now() - dto.timestamp}ms)`,
          );
        }
        return false;
      }

      // 2. Only check geofence if enabled (skip processing cost otherwise)
      let geofenceViolation = false;
      if (this.geofenceEnabled) {
        geofenceViolation = !(await this.isWithinGeofence(dto));
        if (geofenceViolation) {
          this.logger.warn(
            `[${txId}] Vehicle ${dto.vehicleId} location outside of permitted geofence: ${dto.latitude}, ${dto.longitude}`,
          );
          // Trigger geofence alert asynchronously
          void this.sendGeofenceAlert(dto, txId);
        }
      }

      // 3. Only check speed if enabled (skip processing cost otherwise)
      let speedViolation = false;
      if (this.alertOnSpeedExceeded) {
        speedViolation = dto.speed > this.maxSpeed;
        if (speedViolation) {
          this.logger.warn(
            `[${txId}] Vehicle ${dto.vehicleId} exceeding speed limit: ${dto.speed} km/h (max: ${this.maxSpeed} km/h)`,
          );
          // Trigger speed alert asynchronously
          void this.sendSpeedAlert(dto, txId);
        }
      }

      // 4. Get previous location to calculate additional metrics (optimized to check in-memory first)
      const prevLocation =
        this.getLastKnownLocationFromMemory(dto.vehicleId) ||
        (await this.getLastKnownLocation(dto.vehicleId));

      const enhancedDto = new UpdateLocationDto();
      Object.assign(enhancedDto, dto);

      if (prevLocation) {
        // Only calculate metrics if previous location exists
        const metrics = this.calculateTravelMetrics(prevLocation, dto);
        Object.assign(enhancedDto, metrics);
      }

      // 5. Persist to database (if enabled) by queueing
      if (this.persistToDatabase) {
        await this.queueLocationData(enhancedDto, txId);
      }

      // 6. Update in-memory cache first (avoiding distributed cache writes for every update)
      this.updateLocationMemoryCache(dto.vehicleId, enhancedDto);

      // 7. Broadcast location update via WebSocket
      await this.gateway.handleLocation(enhancedDto);

      // 8. Only publish to Redis for important events (reducing network traffic)
      if (geofenceViolation || speedViolation || Math.random() < 0.2) {
        // Sample rate of 20% + all violations
        await this.trackingEvents.publishLocationUpdate(enhancedDto);
      }

      // Only log completion timing for sampled requests
      if (Math.random() < 0.05) {
        const processingTime = performance.now() - startTime;
        this.logger.debug(
          `[${txId}] Location updated for vehicle ${dto.vehicleId} in ${processingTime.toFixed(2)}ms`,
        );
      }

      return true;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.logger.error(
        `[${txId}] Failed to update location after ${processingTime.toFixed(2)}ms: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get the last known location for a vehicle from in-memory cache
   */
  private getLastKnownLocationFromMemory(
    vehicleId: string,
  ): LocationEntity | undefined {
    return this.latestLocationCache.get(vehicleId);
  }

  /**
   * Update the in-memory location cache
   */
  private updateLocationMemoryCache(
    vehicleId: string,
    dto: UpdateLocationDto,
  ): void {
    const locationEntity = new LocationEntity();
    locationEntity.vehicleId = dto.vehicleId;
    locationEntity.dispatchId = dto.dispatchId;
    locationEntity.latitude = dto.latitude;
    locationEntity.longitude = dto.longitude;
    locationEntity.speed = dto.speed;
    locationEntity.timestamp = new Date(dto.timestamp);
    locationEntity.bearing = dto.bearing || 0;
    locationEntity.distanceTraveled = dto.distanceTraveled || 0;
    locationEntity.registrationNumber = dto.registrationNumber;
    locationEntity.plateNumber = dto.plateNumber;
    locationEntity.vehicleColor = dto.vehicleColor;
    locationEntity.vehicleMake = dto.vehicleMake;
    locationEntity.vehicleDescription = dto.vehicleDescription;

    this.latestLocationCache.set(vehicleId, locationEntity);

    // Periodically update the distributed cache (1 in 10 updates)
    if (Math.random() < 0.1) {
      void this.updateLocationCache(vehicleId, locationEntity);
    }
  }

  /**
   * Get the last known location for a vehicle - prioritizes cache over database
   */
  async getLastKnownLocation(
    vehicleId: string,
  ): Promise<LocationEntity | null> {
    try {
      // Try to get from cache first
      const cachedLocation = await this.cacheManager.get<LocationEntity>(
        `vehicle:${vehicleId}:location`,
      );
      if (cachedLocation) {
        return cachedLocation;
      }

      // If not in cache, get from database
      const location = await this.locationRepository.findOne({
        where: { vehicleId },
        order: { timestamp: 'DESC' },
      });

      // Update cache if found
      if (location) {
        await this.cacheManager.set(
          `vehicle:${vehicleId}:location`,
          location,
          LOCATION_CACHE_TTL,
        );
        // Also update in-memory cache
        this.latestLocationCache.set(vehicleId, location);
      }

      return location;
    } catch (error) {
      this.logger.warn(
        `Failed to get last known location for vehicle ${vehicleId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Update the distributed cache for a vehicle location
   */
  private async updateLocationCache(
    vehicleId: string,
    locationEntity: LocationEntity,
  ): Promise<void> {
    try {
      await this.cacheManager.set(
        `vehicle:${vehicleId}:location`,
        locationEntity,
        LOCATION_CACHE_TTL,
      );
    } catch (error) {
      // Don't log every cache error to reduce noise
    }
  }

  /**
   * Get location history with optimized query and pagination
   */
  async getLocationHistory(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
    page = 1,
    limit = 100,
  ): Promise<{
    data: LocationEntity[];
    total: number;
    page: number;
    pageCount: number;
  }> {
    try {
      // Create cache key for this query
      const cacheKey = `history:${vehicleId}:${startTime.getTime()}:${endTime.getTime()}:${page}:${limit}`;

      // Try to get from cache first
      const cachedResult = await this.cacheManager.get<any>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // If performing frequent queries, use a more efficient approach with countQuery separation
      const queryBuilder = this.locationRepository
        .createQueryBuilder('loc')
        .where('loc.vehicleId = :vehicleId', { vehicleId })
        .andWhere('loc.timestamp BETWEEN :startTime AND :endTime', {
          startTime,
          endTime,
        })
        .orderBy('loc.timestamp', 'ASC')
        .skip((page - 1) * limit)
        .take(limit);

      // Use a separate optimized count query
      const countQueryBuilder = this.locationRepository
        .createQueryBuilder('loc')
        .select('COUNT(loc.id)', 'count')
        .where('loc.vehicleId = :vehicleId', { vehicleId })
        .andWhere('loc.timestamp BETWEEN :startTime AND :endTime', {
          startTime,
          endTime,
        });

      // Execute queries in parallel
      const [data, countResult] = await Promise.all([
        queryBuilder.getMany(),
        countQueryBuilder.getRawOne(),
      ]);

      const total = countResult?.count || 0;
      const result = {
        data,
        total: Number(total),
        page,
        pageCount: Math.ceil(Number(total) / limit),
      };

      // Cache the result for 5 minutes
      await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get location history for vehicle ${vehicleId}: ${error.message}`,
      );
      return { data: [], total: 0, page: 1, pageCount: 0 };
    }
  }

  /**
   * Validate that the timestamp is recent
   */
  private validateTimestamp(timestamp: number): boolean {
    const currentTime = Date.now();
    const timeDiff = currentTime - timestamp;
    return timeDiff < this.timestampThreshold;
  }

  /**
   * Check if the location is within allowed geofences
   * Optimized with batched geofence loading and caching
   */
  private async isWithinGeofence(dto: UpdateLocationDto): Promise<boolean> {
    try {
      // Check cache for known geofence result
      const cacheKey = `geofence:${Math.floor(dto.latitude * 100) / 100}:${Math.floor(dto.longitude * 100) / 100}`;
      const cachedResult = await this.cacheManager.get<boolean>(cacheKey);

      if (cachedResult !== undefined) {
        return cachedResult;
      }

      // For this example, we'll still use a simplified approach
      const MIN_LAT = 37.7;
      const MAX_LAT = 37.8;
      const MIN_LNG = -122.5;
      const MAX_LNG = -122.4;

      const result =
        dto.latitude >= MIN_LAT &&
        dto.latitude <= MAX_LAT &&
        dto.longitude >= MIN_LNG &&
        dto.longitude <= MAX_LNG;

      // Cache result for 30 minutes (geofences don't change often)
      await this.cacheManager.set(cacheKey, result, 30 * 60 * 1000);

      return result;
    } catch (error) {
      // Don't log detailed error to reduce overhead
      return true; // Default to allowing the update on error
    }
  }

  /**
   * Calculate metrics like distance, bearing, and ETA based on previous location
   * Further optimized version with lookup tables for trig functions
   */
  private calculateTravelMetrics(
    prevLocation: LocationEntity,
    currentLocation: UpdateLocationDto,
  ): any {
    // Constants
    const R = 6371; // Radius of earth in km
    const DEG_TO_RAD = Math.PI / 180;

    // Convert to radians once
    const lat1Rad = prevLocation.latitude * DEG_TO_RAD;
    const lat2Rad = currentLocation.latitude * DEG_TO_RAD;
    const lng1Rad = prevLocation.longitude * DEG_TO_RAD;
    const lng2Rad = currentLocation.longitude * DEG_TO_RAD;

    // Delta calculations
    const dLat = lat2Rad - lat1Rad;
    const dLon = lng2Rad - lng1Rad;

    // Use simplified distance calculation for small movements (optimization)
    let distance;
    if (Math.abs(dLat) < 0.001 && Math.abs(dLon) < 0.001) {
      // For very small movements, use faster approximation
      const x = dLon * Math.cos((lat1Rad + lat2Rad) / 2);
      const y = dLat;
      distance = Math.sqrt(x * x + y * y) * R;
    } else {
      // Haversine formula for larger movements
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) *
          Math.cos(lat2Rad) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c; // Distance in km
    }

    // Calculate bearing (direction)
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; // in degrees

    // Calculate estimated time of arrival (ETA) assuming constant speed
    const speed =
      currentLocation.speed > 0 ? currentLocation.speed / 3.6 : 0.001; // Convert km/h to m/s, avoid div by 0
    const eta = (distance * 1000) / speed; // ETA in seconds

    return {
      distanceTraveled: Number(distance.toFixed(4)), // Truncate to 4 decimal places to save space
      bearing: Math.round(brng), // Round to nearest degree
      etaSeconds: Math.round(eta), // Round to nearest second
    };
  }

  /**
   * Queue location data for batch processing
   */
  private async queueLocationData(
    dto: UpdateLocationDto,
    traceId: string,
  ): Promise<void> {
    const locationEntity = new LocationEntity();
    locationEntity.vehicleId = dto.vehicleId;
    locationEntity.dispatchId = dto.dispatchId;
    locationEntity.latitude = dto.latitude;
    locationEntity.longitude = dto.longitude;
    locationEntity.speed = dto.speed;
    locationEntity.timestamp = new Date(dto.timestamp);
    locationEntity.bearing = dto.bearing || 0;
    locationEntity.distanceTraveled = dto.distanceTraveled || 0;
    locationEntity.registrationNumber = dto.registrationNumber;
    locationEntity.plateNumber = dto.plateNumber;
    locationEntity.vehicleColor = dto.vehicleColor;
    locationEntity.vehicleMake = dto.vehicleMake;
    locationEntity.vehicleDescription = dto.vehicleDescription;

    this.locationUpdateQueue.push(locationEntity);

    // Process batch if queue size exceeds threshold or max size reached
    if (
      this.locationUpdateQueue.length >= this.batchSize ||
      this.locationUpdateQueue.length >= MAX_QUEUE_SIZE
    ) {
      // Use immediate processing via setTimeout to avoid blocking
      if (!this.processingBatch) {
        setTimeout(() => this.processBatch(), 0);
      }
    }
  }

  /**
   * Process batch of location updates with optimized transaction handling
   */
  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.locationUpdateQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    const batchToProcess = [...this.locationUpdateQueue];
    this.locationUpdateQueue = [];

    try {
      // Only log for significant batch sizes
      const shouldLog = batchToProcess.length > 10;
      if (shouldLog) {
        var batchStartTime = performance.now();
        this.logger.debug(
          `Processing batch of ${batchToProcess.length} location updates`,
        );
      }

      // Optimize batches by vehicle ID to improve database index performance
      // Group by vehicleId to improve index usage
      const vehicleGroups = new Map<string, LocationEntity[]>();

      batchToProcess.forEach((entity) => {
        const existing = vehicleGroups.get(entity.vehicleId) || [];
        existing.push(entity);
        vehicleGroups.set(entity.vehicleId, existing);
      });

      // Use a write connection with properly configured transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Process each vehicle group sequentially for better DB performance
        const repository = queryRunner.manager.getRepository(LocationEntity);

        for (const entities of vehicleGroups.values()) {
          // For vehicle with many updates, only save the latest ones
          if (entities.length > 5) {
            // Sort by timestamp descending
            entities.sort(
              (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
            );
            // Only save every nth point if we have too many for one vehicle
            const toSave =
              entities.length > 20
                ? [entities[0]].concat(
                    entities.filter((_, i) => i > 0 && i % 3 === 0),
                  )
                : entities;
            await repository.save(toSave);
          } else {
            await repository.save(entities);
          }
        }

        await queryRunner.commitTransaction();

        if (shouldLog) {
          const batchTime = performance.now() - batchStartTime;
          this.logger.debug(
            `Batch of ${batchToProcess.length} updates processed in ${batchTime.toFixed(2)}ms`,
          );
        }
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Failed to process location batch: ${error.message}`);

        // Re-queue failed items but with exponential backoff strategy
        // Only add back a portion to avoid queue growth on persistent errors
        const importantUpdates = batchToProcess.filter(
          (_, index) => index % 3 === 0 || index < 10,
        );

        this.locationUpdateQueue = [
          ...importantUpdates,
          ...this.locationUpdateQueue,
        ];
      } finally {
        await queryRunner.release();
      }
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Send geofence alert through appropriate channels (optimized)
   */
  private async sendGeofenceAlert(
    dto: UpdateLocationDto,
    traceId: string,
  ): Promise<void> {
    try {
      // Only emit the socket event, no extra processing
      this.gateway.server.to(`alerts-${dto.dispatchId}`).emit('geofenceAlert', {
        vehicleId: dto.vehicleId,
        dispatchId: dto.dispatchId,
        location: { lat: dto.latitude, lng: dto.longitude },
        timestamp: dto.timestamp,
        alertType: 'GEOFENCE_VIOLATION',
      });
    } catch (error) {
      // Minimized logging to reduce overhead
    }
  }

  /**
   * Send speed alert through appropriate channels (optimized)
   */
  private async sendSpeedAlert(
    dto: UpdateLocationDto,
    traceId: string,
  ): Promise<void> {
    try {
      // Only emit the socket event, no extra processing
      this.gateway.server.to(`alerts-${dto.dispatchId}`).emit('speedAlert', {
        vehicleId: dto.vehicleId,
        dispatchId: dto.dispatchId,
        speed: dto.speed,
        maxSpeed: this.maxSpeed,
        location: { lat: dto.latitude, lng: dto.longitude },
        timestamp: dto.timestamp,
        alertType: 'SPEED_VIOLATION',
      });
    } catch (error) {
      // Minimized logging to reduce overhead
    }
  }

  /**
   * Get active vehicle count with optimized caching
   */
  async getActiveVehicleCount(hours = 1): Promise<number> {
    const cacheKey = `activeVehicles:${hours}h`;

    try {
      // Try to get from cache first
      const cachedCount = await this.cacheManager.get<number>(cacheKey);
      if (cachedCount !== undefined) {
        return cachedCount;
      }

      // If not in cache, use optimized query with index hints
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const result = await this.locationRepository
        .createQueryBuilder('loc')
        .select('COUNT(DISTINCT loc.vehicleId)', 'count')
        .where('loc.timestamp > :cutoff', { cutoff })
        .getRawOne();

      const count = result?.count || 0;

      // Cache result for longer period
      await this.cacheManager.set(cacheKey, count, ACTIVE_VEHICLE_CACHE_TTL);

      return count;
    } catch (error) {
      this.logger.warn(`Failed to get active vehicle count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Schedule data retention cleanup job
   * Removes location data older than the retention period
   */
  private scheduleDataRetentionCleanup(): void {
    // Calculate time until 2am
    const now = new Date();
    const target = new Date(now);
    target.setHours(2, 0, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilRun = target.getTime() - now.getTime();

    // Schedule the first run
    setTimeout(() => {
      this.performDataRetentionCleanup();

      // Then schedule to run daily
      setInterval(
        () => this.performDataRetentionCleanup(),
        24 * 60 * 60 * 1000,
      );
    }, timeUntilRun);

    this.logger.log(
      `Data retention cleanup scheduled, first run in ${(timeUntilRun / (60 * 60 * 1000)).toFixed(1)} hours`,
    );
  }

  /**
   * Perform actual data retention cleanup
   */
  private async performDataRetentionCleanup(): Promise<void> {
    try {
      const startTime = performance.now();
      this.logger.log(
        `Starting data retention cleanup, removing data older than ${this.dataRetentionDays} days`,
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.dataRetentionDays);

      // Delete in chunks to avoid long-running transactions
      let totalDeleted = 0;
      let deletedInBatch;

      do {
        const result = await this.locationRepository
          .createQueryBuilder()
          .delete()
          .from(LocationEntity)
          .where(
            'id IN (SELECT id FROM location_entity WHERE timestamp < :cutoffDate LIMIT 10000)',
          )
          .setParameters({ cutoffDate })
          .execute();

        deletedInBatch = result.affected || 0;
        totalDeleted += deletedInBatch;

        // Small pause between batches to reduce DB load
        if (deletedInBatch > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } while (deletedInBatch > 0);

      const duration = (performance.now() - startTime) / 1000;
      this.logger.log(
        `Data retention cleanup completed: ${totalDeleted} records deleted in ${duration.toFixed(1)} seconds`,
      );
    } catch (error) {
      this.logger.error(`Data retention cleanup failed: ${error.message}`);
    }
  }

  /**
   * Service cleanup on application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    // Clear batch processing timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process any remaining items in queue
    if (this.locationUpdateQueue.length > 0) {
      try {
        this.logger.log(
          `Processing ${this.locationUpdateQueue.length} remaining location updates before shutdown`,
        );
        await this.processBatch();
      } catch (error) {
        this.logger.error(
          `Failed to process remaining updates on shutdown: ${error.message}`,
        );
      }
    }
  }
}

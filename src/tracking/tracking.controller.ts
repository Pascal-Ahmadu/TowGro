// src/tracking/tracking.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Query,
  ValidationPipe,
  Logger,
  UseInterceptors, // Remove duplicate import
  // UseInterceptors, <- This duplicate line should be removed
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager'; // Make sure this import is present
import { TrackingService } from './tracking.service';
import { UpdateLocationDto } from './dto/tracking.dto';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('api/v1/tracking') // Updated controller path
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly trackingService: TrackingService) {}

  @Post('location') // Now matches /api/v1/tracking/location
  @UseGuards(WsJwtAuthGuard, ThrottlerGuard, RolesGuard)
  @Roles('admin', 'driver')
  async updateLocation(@Body(ValidationPipe) dto: UpdateLocationDto) {
    const txId = `api-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    this.logger.debug(
      `[${txId}] API request to update location for vehicle ${dto.vehicleId}`,
    );

    const result = await this.trackingService.updateLocation(dto, txId);
    return { success: result };
  }

  @UseGuards(WsJwtAuthGuard, RolesGuard)
  @Roles('admin', 'dispatcher')
  @UseInterceptors(CacheInterceptor) // Now using properly imported interceptor
  // Keep other endpoints as they are but they'll now be under /api/v1/tracking
  @Get('vehicle/:vehicleId/latest')
  async getLatestLocation(@Param('vehicleId') vehicleId: string) {
    const location = await this.trackingService.getLastKnownLocation(vehicleId);
    return location
      ? {
          vehicleId: location.vehicleId,
          location: {
            lat: location.latitude,
            lng: location.longitude,
          },
          speed: location.speed,
          timestamp: location.timestamp,
          bearing: location.bearing,
        }
      : { message: 'No location data available' };
  }

  @UseGuards(WsJwtAuthGuard, RolesGuard)
  @Roles('admin', 'dispatcher') // Update other instances similarly
  @Get('vehicle/:vehicleId/history')
  async getLocationHistory(
    @Param('vehicleId') vehicleId: string,
    @Query('start') startTime: string,
    @Query('end') endTime: string,
  ) {
    const start = new Date(startTime || Date.now() - 24 * 60 * 60 * 1000);
    const end = new Date(endTime || Date.now());

    // Destructure the result to get the data array
    const { data: locations } = await this.trackingService.getLocationHistory(
      vehicleId,
      start,
      end,
    );

    // Now we can safely map over the locations array
    return locations.map((loc) => ({
      vehicleId: loc.vehicleId,
      location: {
        lat: loc.latitude,
        lng: loc.longitude,
      },
      speed: loc.speed,
      timestamp: loc.timestamp,
      bearing: loc.bearing,
      distanceTraveled: loc.distanceTraveled,
    }));
  }
}

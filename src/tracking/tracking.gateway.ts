import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UseGuards,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { UpdateLocationDto, JoinDispatchDto } from './dto/tracking.dto';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: process.env.WS_CORS_ORIGIN,
    credentials: true,
  }
})

export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(TrackingGateway.name);
  private redisAvailable = false;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Try to connect to Redis as the module initializes
    await this.initializeRedisClients();
  }

  // Interface implementation
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Setup Redis adapter if Redis is available
    if (this.redisAvailable) {
      try {
        server.adapter(createAdapter(this.pubClient, this.subClient));
        this.logger.log('WebSocket Redis adapter configured successfully');
      } catch (err) {
        this.logger.error(`Failed to initialize Redis adapter: ${err.message}`);
        this.logger.warn('WebSocket gateway will operate without Redis adapter (limited to single instance)');
      }
    }
    
    // Configure CORS
    const corsOrigin = this.configService.get<string>('WS_CORS_ORIGIN');
    this.logger.log(`Setting WebSocket CORS origin to: ${corsOrigin}`);
    
    // Handle multiple origins if needed
    const origins = corsOrigin ? corsOrigin.split(',').map(origin => origin.trim()) : ['*'];
    server.engine.on("headers", (headers, req) => {
      const requestOrigin = req.headers.origin;
      if (origins.includes(requestOrigin) || origins.includes('*')) {
        headers["Access-Control-Allow-Origin"] = requestOrigin;
        headers["Access-Control-Allow-Credentials"] = "true";
      }
    });
  }

  // Combined connection handler implementation
  handleConnection(client: Socket) {
    client.emit('notification_channel', { status: 'connected' });
    this.logger.debug(`Client connected: ${client.id}`);
  }

  // Single disconnection handler implementation
  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // Add the missing handleLocation method that's being called from TrackingService
  async handleLocation(dto: UpdateLocationDto): Promise<void> {
    try {
      this.logger.debug(`Broadcasting location update for vehicle ${dto.vehicleId}`);
      
      // Emit to the specific dispatch room if available
      if (dto.dispatchId) {
        this.server.to(`dispatch_${dto.dispatchId}`).emit('location_update', dto);
      }
      
      // Also emit to the vehicle-specific room
      this.server.to(`vehicle_${dto.vehicleId}`).emit('location_update', dto);
      
      // Emit to a general tracking channel for admin dashboards
      this.server.emit('tracking_updates', dto);
    } catch (error) {
      this.logger.error(`Error broadcasting location: ${error.message}`);
    }
  }

  // Add a method to join dispatch room
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('join_dispatch')
  async joinDispatch(
    @MessageBody() data: JoinDispatchDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const room = `dispatch_${data.dispatchId}`;
      await client.join(room);
      this.logger.debug(`Client ${client.id} joined room ${room}`);
      client.emit('room_joined', { room, status: 'joined' });
    } catch (error) {
      throw new WsException(`Could not join dispatch: ${error.message}`);
    }
  }
  
  private async initializeRedisClients() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (!redisUrl) {
      this.logger.warn('Redis URL not provided in environment variables. WebSocket gateway will operate without Redis adapter.');
      return;
    }
    
    // Ensure we're not connecting to localhost
    if (redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost')) {
      this.logger.warn('Localhost Redis connection detected. This may cause issues in production environments.');
      // You might want to override with the actual Redis URL here if needed
      // redisUrl = 'redis://your-actual-redis-server:6379';
    }

    try {
      // Parse the Redis URL to ensure we're not using localhost
      const parsedUrl = new URL(redisUrl);
      
      // If URL is localhost/127.0.0.1 and we have an actual Redis hostname available, use that instead
      if ((parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') && 
          process.env.REDIS_HOST) {
        this.logger.warn(`Avoiding localhost Redis connection. Using REDIS_HOST environment variable instead.`);
        // Use the environment variable for the host but keep the original port
        parsedUrl.hostname = process.env.REDIS_HOST;
        // Reconstruct the URL
        const correctedUrl = parsedUrl.toString();
        this.logger.log(`Using corrected Redis URL: ${correctedUrl.split('@').length > 1 ? correctedUrl.split('@')[1] : correctedUrl}`);
        redisUrl = correctedUrl;
      }
      
      // Configure Redis clients with better error handling
      this.pubClient = new Redis(redisUrl, {
        reconnectOnError: (err) => {
          this.logger.error(`Redis reconnect error: ${err.message}`);
          return true; // Always try to reconnect
        },
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          this.logger.warn(`Redis connection attempt ${times} failed. Retrying in ${delay}ms...`);
          return delay;
        },
        maxRetriesPerRequest: 5,
        connectTimeout: 10000, // 10 seconds
        enableReadyCheck: true,
        enableOfflineQueue: true,
      });
      
      this.subClient = new Redis(redisUrl, {
        reconnectOnError: (err) => {
          this.logger.error(`Redis subscriber reconnect error: ${err.message}`);
          return true;
        },
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        maxRetriesPerRequest: 5,
        connectTimeout: 10000,
        enableReadyCheck: true,
        enableOfflineQueue: true,
      });

      // Add some additional debugging for connection issues
      this.logger.debug(`Attempting to connect to Redis at: ${
        redisUrl.includes('@') ? 
        redisUrl.replace(/\/\/([^:]+:[^@]+@)/, '//***:***@') : // Hide credentials in logs
        redisUrl
      }`);
      
      // Set up event listeners for both clients
      for (const client of [this.pubClient, this.subClient]) {
        client.on('error', (err) => {
          this.logger.error(`Redis connection error: ${err.message}`);
        });

        client.on('connect', () => {
          this.logger.log(`Redis client connected successfully to ${redisUrl.includes('@') ? redisUrl.split('@')[1] : redisUrl}`);
        });

        client.on('ready', () => {
          this.redisAvailable = true;
          this.logger.log('Redis client ready');
        });

        client.on('end', () => {
          this.redisAvailable = false;
          this.logger.warn('Redis connection closed');
        });
      }

      // Wait for clients to be ready
      await Promise.all([
        new Promise<void>((resolve) => {
          this.pubClient.once('ready', () => resolve());
        }),
        new Promise<void>((resolve) => {
          this.subClient.once('ready', () => resolve());
        }),
      ]).catch(err => {
        this.logger.error(`Failed to initialize Redis clients: ${err.message}`);
        this.redisAvailable = false;
      });

    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.redisAvailable = false;
      
      // Fall back to in-memory adapter (default)
      this.logger.warn('WebSocket gateway will operate without Redis adapter (limited to single instance)');
    }
  }
}
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
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';  // Changed from * as redis import
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { WsThrottlerGuard } from '../common/guards/ws-throttler.guard';
import { UpdateLocationDto, JoinDispatchDto } from './dto/tracking.dto';
import { ConfigService } from '@nestjs/config';
// Import RedisFactory if needed
// import { RedisFactory } from '../common/redis/redis.factory';

// Remove any adapter configuration from the decorator
@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: process.env.WS_CORS_ORIGIN,
    credentials: true,
  }
})

export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  // Single constructor definition
  constructor(private configService: ConfigService) {}

  // Interface implementation
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Setup Redis adapter with proper error handling
    this.setupRedisAdapter(server).catch(err => {
      this.logger.error(`Failed to initialize Redis adapter: ${err.message}`);
      this.logger.warn('WebSocket gateway will operate without Redis adapter (limited to single instance)');
    });
    
    // In the afterInit method
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
  
  private async setupRedisAdapter(server: Server) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (!redisUrl) {
      this.logger.error('Redis connection failed: REDIS_URL environment variable required');
      process.exit(1);
    }

    const pubClient = new Redis(redisUrl);
    const subClient = new Redis(redisUrl);

    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log(`WebSocket Redis adapter configured with URL: ${redisUrl.split('@')[1]}`);
  }
}
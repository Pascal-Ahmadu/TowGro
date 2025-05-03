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
import * as redis from 'redis';
import { WsJwtAuthGuard } from '../auth/guards/ws-jwt-auth.guard';
import { WsThrottlerGuard } from '../common/guards/ws-throttler.guard';
import { UpdateLocationDto, JoinDispatchDto } from './dto/tracking.dto';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  transports: ['websocket'],
  // Remove the static adapter configuration
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private configService: ConfigService) {}

  // Interface implementation
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Always setup Redis adapter in production and development
    this.setupRedisAdapter(server);
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

  // Update the setupRedisAdapter method
  private async setupRedisAdapter(server: Server) {
    try {
      // First check if REDIS_URL is available
      const redisUrl = this.configService.get<string>('REDIS_URL');
      
      if (!redisUrl) {
        this.logger.warn('No REDIS_URL found, WebSocket scaling will be limited');
        return; // Skip adapter setup if no Redis URL
      }
      
      this.logger.log('Using REDIS_URL for WebSocket adapter');
      const pubClient = redis.createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      
      // Add error handlers
      pubClient.on('error', (err) => {
        this.logger.error(`Redis pub client error: ${err.message}`);
      });
      
      subClient.on('error', (err) => {
        this.logger.error(`Redis sub client error: ${err.message}`);
      });
  
      await Promise.all([pubClient.connect(), subClient.connect()]);
  
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Redis adapter configured for WebSocket gateway');
    } catch (error) {
      this.logger.error(`Failed to setup Redis adapter: ${error.message}`);
      // Continue without Redis adapter - will work for single instance
    }
  }

  // Rest of your methods remain unchanged
  // ...
}

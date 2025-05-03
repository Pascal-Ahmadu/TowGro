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

// Remove any adapter configuration from the decorator
@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: process.env.WS_CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  }
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
    
    // Setup Redis adapter with proper error handling
    this.setupRedisAdapter(server).catch(err => {
      this.logger.error(`Failed to initialize Redis adapter: ${err.message}`);
      this.logger.warn('WebSocket gateway will operate without Redis adapter (limited to single instance)');
    });
    
    // In the afterInit method
    const corsOrigin = this.configService.get<string>('WS_CORS_ORIGIN');
    this.logger.log(`Setting WebSocket CORS origin to: ${corsOrigin}`);
    
    // Handle multiple origins if needed
    const origins = corsOrigin.split(',').map(origin => origin.trim());
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

  // Update the setupRedisAdapter method with better error handling
  private async setupRedisAdapter(server: Server) {
    try {
      // First check if REDIS_URL is available
      const redisUrl = this.configService.get<string>('REDIS_URL');
      
      if (!redisUrl) {
        this.logger.warn('No REDIS_URL found, WebSocket scaling will be limited');
        return; // Skip adapter setup if no Redis URL
      }
      
      this.logger.log(`Using Redis URL for WebSocket adapter: ${redisUrl.split('@').pop()}`); // Log only host part for security
      
      // Create Redis clients with proper socket configuration
      const pubClient = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            const delay = Math.min(retries * 50, 1000);
            this.logger.debug(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          }
        }
      });
      
      const subClient = pubClient.duplicate();
      
      // Add error handlers
      pubClient.on('error', (err) => {
        this.logger.error(`Redis pub client error: ${err.message}`);
      });
      
      subClient.on('error', (err) => {
        this.logger.error(`Redis sub client error: ${err.message}`);
      });
      
      // Add connection event handlers
      pubClient.on('connect', () => {
        this.logger.log('Redis pub client connected successfully');
      });
      
      subClient.on('connect', () => {
        this.logger.log('Redis sub client connected successfully');
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

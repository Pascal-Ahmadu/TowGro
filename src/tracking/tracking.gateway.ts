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
  // Fix adapter configuration
  adapter: createAdapter(
    redis.createClient({ url: process.env.REDIS_URL }),
    redis.createClient({ url: process.env.REDIS_URL }),
  ),
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

    if (this.configService.get('NODE_ENV') === 'production') {
      this.setupRedisAdapter(server);
    }
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

  // Notification method
  sendTaskbarNotification(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('taskbar_notification', notification);
  }

  // New call functionality
  initiateCall(
    userId: string,
    callData: { callerId: string; callerName: string },
  ) {
    this.logger.debug(
      `Initiating call to user ${userId} from ${callData.callerName}`,
    );
    this.server.to(`user_${userId}`).emit('incoming_call', {
      callerId: callData.callerId,
      callerName: callData.callerName,
      timestamp: new Date().toISOString(),
    });
    return { success: true, message: `Call initiated to user ${userId}` };
  }

  // New message functionality
  sendDirectMessage(
    userId: string,
    messageData: { senderId: string; senderName: string; content: string },
  ) {
    this.logger.debug(
      `Sending direct message to user ${userId} from ${messageData.senderName}`,
    );
    this.server.to(`user_${userId}`).emit('direct_message', {
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      content: messageData.content,
      timestamp: new Date().toISOString(),
    });
    return { success: true, message: `Message sent to user ${userId}` };
  }

  // Add user to their personal room for direct communications
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('registerForDirectCommunication')
  handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      const roomName = `user_${data.userId}`;
      client.join(roomName);
      this.logger.debug(
        `User ${data.userId} registered for direct communication`,
      );
      return { success: true, message: 'Registered for direct communication' };
    } catch (error) {
      this.logger.error(
        `Error registering for direct communication: ${error.message}`,
      );
      throw new WsException('Failed to register for direct communication');
    }
  }

  // Update the setupRedisAdapter method
  private async setupRedisAdapter(server: Server) {
    try {
      // First check if REDIS_URL is available
      const redisUrl = this.configService.get<string>('REDIS_URL');
      
      let pubClient;
      if (redisUrl) {
        this.logger.log('Using REDIS_URL for WebSocket adapter');
        pubClient = redis.createClient({ url: redisUrl });
      } else {
        const host = this.configService.get('REDIS_HOST', 'localhost');
        const port = this.configService.get('REDIS_PORT', 6379);
        const password = this.configService.get('REDIS_PASSWORD', '');
        
        const options = {
          url: `redis://${host}:${port}`,
        };
        
        if (password) {
          options.url = `redis://:${password}@${host}:${port}`;
        }
        
        this.logger.log(`Using Redis connection params: ${host}:${port}`);
        pubClient = redis.createClient(options);
      }
  
      const subClient = pubClient.duplicate();
  
      await Promise.all([pubClient.connect(), subClient.connect()]);
  
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Redis adapter configured for WebSocket gateway');
    } catch (error) {
      this.logger.error(`Failed to setup Redis adapter: ${error.message}`);
    }
  }

  @UseGuards(WsJwtAuthGuard, WsThrottlerGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('joinDispatch')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinDispatchDto,
  ) {
    try {
      client.join(dto.dispatchId);
      this.logger.debug(
        `Client ${client.id} joined dispatch ${dto.dispatchId}`,
      );
      return { success: true, message: `Joined dispatch ${dto.dispatchId}` };
    } catch (error) {
      this.logger.error(`Error joining dispatch: ${error.message}`);
      throw new WsException('Failed to join dispatch');
    }
  }

  @UseGuards(WsJwtAuthGuard, WsThrottlerGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('updateLocation')
  handleLocation(@MessageBody() dto: UpdateLocationDto) {
    try {
      this.logger.debug(
        `Broadcasting location update for vehicle ${dto.vehicleId} ${dto.plateNumber ? `(${dto.plateNumber})` : ''} in dispatch ${dto.dispatchId}`,
      );

      // Include timestamp and send to the dispatch room
      this.server.to(dto.dispatchId).emit('locationUpdate', {
        ...dto,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error broadcasting location: ${error.message}`);
      throw new WsException('Failed to broadcast location update');
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('leaveDispatch')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinDispatchDto,
  ) {
    try {
      client.leave(dto.dispatchId);
      this.logger.debug(`Client ${client.id} left dispatch ${dto.dispatchId}`);
      return { success: true, message: `Left dispatch ${dto.dispatchId}` };
    } catch (error) {
      this.logger.error(`Error leaving dispatch: ${error.message}`);
      throw new WsException('Failed to leave dispatch');
    }
  }

  // Add vehicle registration method
  @UseGuards(WsJwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('registerVehicle')
  handleVehicleRegistration(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      vehicleId: string;
      registrationNumber: string;
      plateNumber: string;
      driverId: string;
    },
  ) {
    try {
      // Join a room specific to this vehicle
      const vehicleRoom = `vehicle_${data.vehicleId}`;
      client.join(vehicleRoom);

      this.logger.debug(
        `Vehicle registered: ID=${data.vehicleId}, Reg=${data.registrationNumber}, Plate=${data.plateNumber}, Driver=${data.driverId}`,
      );

      // Broadcast to admin channel that a new vehicle is registered
      this.server.to('admin_channel').emit('vehicle_registered', {
        vehicleId: data.vehicleId,
        registrationNumber: data.registrationNumber,
        plateNumber: data.plateNumber,
        driverId: data.driverId,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Vehicle registered successfully',
        vehicleId: data.vehicleId,
      };
    } catch (error) {
      this.logger.error(`Error registering vehicle: ${error.message}`);
      throw new WsException('Failed to register vehicle');
    }
  }
}

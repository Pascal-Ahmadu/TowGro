import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';  // Add ThrottlerRequest import
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(WsThrottlerGuard.name);
  
  async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const { context, ttl, limit } = request;
    const blockDuration = request.blockDuration || 0;
    
    // Fix: Add both required arguments to getTracker
    const client = context.switchToWs().getClient();
    const ip = client.handshake.address;
    const tracker = await request.getTracker?.(context, client.handshake) || 'default';
    
    const key = `${context.getClass().name}-${context.getHandler().name}-${ip}`;
    
    const { totalHits } = await this.storageService.increment(
      key, 
      ttl,
      limit,
      blockDuration,
      tracker
    );
    
    if (totalHits > limit) {
      this.logger.warn(`Rate limit exceeded for ${key}`);
      throw new WsException('Too many requests');
    }
    
    return true;
  }
}
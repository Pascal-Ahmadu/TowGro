import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class IpFilterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpFilterMiddleware.name);
  private readonly whitelistedIps: string[];
  private readonly blacklistedIps: string[];
  private readonly maxRequestsPerMinute: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.whitelistedIps = this.configService
      .get<string>('IP_WHITELIST', '')
      .split(',')
      .filter(Boolean);
    
    this.blacklistedIps = this.configService
      .get<string>('IP_BLACKLIST', '')
      .split(',')
      .filter(Boolean);
    
    this.maxRequestsPerMinute = this.configService.get<number>('MAX_REQUESTS_PER_MINUTE', 100);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const clientIp = req.ip || req.socket.remoteAddress;
    
    // Allow whitelisted IPs
    if (this.whitelistedIps.includes(clientIp)) {
      return next();
    }
    
    // Block blacklisted IPs
    if (this.blacklistedIps.includes(clientIp)) {
      this.logger.warn(`Blocked request from blacklisted IP: ${clientIp}`);
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Track request count for IP
    const key = `ip:${clientIp}:requests`;
    const count = await this.redis.incr(key);
    
    // Set expiry for the key if it's new
    if (count === 1) {
      await this.redis.expire(key, 60); // 60 seconds
    }
    
    // Check if IP exceeds threshold
    if (count > this.maxRequestsPerMinute) {
      // Add to temporary blacklist
      await this.redis.setex(`ip:${clientIp}:blocked`, 300, '1'); // Block for 5 minutes
      this.logger.warn(`Temporarily blocked IP ${clientIp} for excessive requests: ${count}/min`);
      return res.status(429).json({ message: 'Too many requests' });
    }
    
    // Check if IP is temporarily blocked
    const isBlocked = await this.redis.get(`ip:${clientIp}:blocked`);
    if (isBlocked) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    
    next();
  }
}
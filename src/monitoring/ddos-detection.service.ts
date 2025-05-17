import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DdosDetectionService {
  private readonly logger = new Logger(DdosDetectionService.name);
  private readonly alertThreshold: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.alertThreshold = this.configService.get<number>('DDOS_ALERT_THRESHOLD', 1000);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkForAttacks() {
    const keys = await this.redis.keys('ip:*:requests');
    const suspiciousIps = [];
    
    for (const key of keys) {
      const count = parseInt(await this.redis.get(key), 10);
      const ip = key.split(':')[1];
      
      if (count > this.alertThreshold) {
        suspiciousIps.push({ ip, count });
        
        // Add to temporary blacklist for 15 minutes
        await this.redis.setex(`ip:${ip}:blocked`, 900, '1');
      }
    }
    
    if (suspiciousIps.length > 0) {
      this.logger.warn(`Potential DDoS attack detected from IPs: ${JSON.stringify(suspiciousIps)}`);
      
      // Send alert to administrators
      await this.notificationsService.sendEmail({
        to: this.configService.get('ADMIN_EMAIL', 'admin@example.com'),
        subject: 'DDoS Attack Alert',
        text: `Potential DDoS attack detected from the following IPs:\n\n${
          suspiciousIps.map(({ ip, count }) => `${ip}: ${count} requests/min`).join('\n')
        }`,
      });
    }
  }
}
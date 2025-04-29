import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailerModule } from '@nestjs-modules/mailer';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { redisInsStore } from 'cache-manager-redis-yet';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RedisFactory } from './common/redis/redis.factory';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { NotificationsModule } from './notifications/notifications.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { PaymentModule } from './payment/payment.module';
import { TrackingModule } from './tracking/tracking.module';
import { ApiGatewayModule } from './api-gateway/api-gateway.module'; // Add this import
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import { MonitoringModule } from './monitoring/monitoring.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './monitoring/metrics.interceptor';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { Redis } from 'ioredis';
import { RedisHealth } from './health/redis-health';

@Module({
  imports: [
    // 1. Load .env and validate required vars
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local', '.env.development', '.env'],
      validationOptions: { allowUnknown: false, forbidNonWhitelisted: true },
    }),

    // 2. Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        synchronize: config.get('DB_SYNC') === 'true',
        autoLoadEntities: true,
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: false
          }
        },
        // Add migration configuration
        migrations: [__dirname + '/migrations/**/*.{js,ts}'],
        migrationsRun: false, // Don't run migrations automatically on startup
        migrationsTableName: 'migrations'
      }),
    }),

    // 4. Throttler - now using our custom storage implementation
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          {
            ttl: cfg.get<number>('THROTTLE_TTL', 60),
            limit: cfg.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // 5. Mailer config
    MailerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get('MAIL_PORT'),
          secure: false, // No SSL for testing
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASSWORD')
          }
        }
      }),
      inject: [ConfigService],
    }),

    // 6. Cache manager with Redis store
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST', 'localhost');
        const port = configService.get('REDIS_PORT', 6379);
        const password = configService.get('REDIS_PASSWORD', '');

        return {
          store: redisInsStore,
          socket: {
            host,
            port,
            tls: host !== 'localhost' ? { rejectUnauthorized: false } : undefined,
          },
          password: password || undefined,
          ttl: 60, // seconds
          // Add error handling
          onError: (error) => {
            console.error('Redis cache error:', error);
          }
        };
      },
    }),
    
    // 7. Payment Module - ensure proper initialization
    forwardRef(() => PaymentModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    
    // 8. Feature modules
    NotificationsModule,
    DispatchModule,
    TrackingModule,
    ApiGatewayModule, // Add the API Gateway module here
    MonitoringModule,
    
    // Add rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([
        {
          ttl: config.get('THROTTLE_TTL', 60),
          limit: config.get('THROTTLE_LIMIT', 10),
        },
      ]),
    }),
    // Move WinstonModule inside the imports array
    WinstonModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        level: config.get('LOG_LEVEL') || 'info',
        format: format.combine(
          format.timestamp(),
          config.get('NODE_ENV') === 'production' 
            ? format.json()
            : format.prettyPrint()
        ),
        transports: [
          new transports.Console(),
          new transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5
          }),
          new transports.File({
            filename: 'logs/error.log',
            level: 'error',
            handleExceptions: true
          })
        ]
      }),
      inject: [ConfigService]
    }),
    
    TerminusModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    RedisFactory,
    RedisThrottlerStorage,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: 'THROTTLER_STORAGE',
      useClass: RedisThrottlerStorage,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // Redis client provider
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => new Redis({
        host: config.get('REDIS_HOST'),
        port: config.get('REDIS_PORT'),
      }),
      inject: [ConfigService],
    },
    // Redis health check provider
    {
      provide: RedisHealth,
      useClass: RedisHealth,
    }
  ],
})
export class AppModule {}
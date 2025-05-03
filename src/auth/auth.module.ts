import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.stategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RedisCacheModule } from '../cache/cache.module';
import { AccountLockoutService } from './services/account-lockout.service';
import { PaymentModule } from '../payment/payment.module';
import { MailModule } from '../mail/mail.module';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { ThrottlerModule } from '@nestjs/throttler';

// Define the createMockRedisClient function before the @Module decorator
function createMockRedisClient() {
  const storage = new Map();

  return {
    set: async (key, value, mode?, duration?) => {
      console.log(
        `[MOCK REDIS] SET ${key} = ${value} ${mode || ''} ${duration || ''}`,
      );
      storage.set(key, value);
      return 'OK';
    },
    get: async (key) => {
      console.log(`[MOCK REDIS] GET ${key}`);
      return storage.get(key);
    },
    del: async (key) => {
      console.log(`[MOCK REDIS] DEL ${key}`);
      storage.delete(key);
      return 1;
    },
    incr: async (key) => {
      console.log(`[MOCK REDIS] INCR ${key}`);
      const value = (storage.get(key) || 0) + 1;
      storage.set(key, value.toString());
      return value;
    },
    expire: async (key, seconds) => {
      console.log(`[MOCK REDIS] EXPIRE ${key} ${seconds}`);
      return 1;
    },
    exists: async (key) => {
      console.log(`[MOCK REDIS] EXISTS ${key}`);
      return storage.has(key) ? 1 : 0;
    },
    ping: async () => {
      console.log(`[MOCK REDIS] PING`);
      return 'PONG';
    },
    on: (event, callback) => {
      // Do nothing for events
      return { on: () => {} };
    },
    connect: async () => {
      console.log(`[MOCK REDIS] CONNECT`);
      return Promise.resolve();
    },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot(), // Make sure ConfigModule is properly initialized
    forwardRef(() => UsersModule), // Use forwardRef for potential circular deps
    PassportModule.register({ defaultStrategy: 'jwt' }), // Initialize Passport
    forwardRef(() => RedisCacheModule), // Use forwardRef
    forwardRef(() => PaymentModule), // Already using forwardRef
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: cfg.get<string>('JWT_ACCESS_EXPIRES') },
      }),
      inject: [ConfigService],
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'single',
        url: cfg.get('REDIS_URL'),
      }),
    }),
    MailModule,
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    EmailVerificationService,
    PasswordResetService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get('REDIS_HOST');
        const redisPort = parseInt(configService.get('REDIS_PORT'));
        const redisPass = configService.get('REDIS_PASSWORD');

        return new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPass, // Add password
          lazyConnect: true, // Don't connect immediately
          retryStrategy: (times) => {
            console.log(`Redis connection retry attempt ${times}`);
            return Math.min(times * 500, 5000); // Increase retry interval with backoff
          },
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false, // Don't queue commands when disconnected
          connectTimeout: 10000, // 10 seconds timeout
        });
      }
      inject: [ConfigService],
    },
    // AccountLockoutService as a provider
    {
      provide: AccountLockoutService,
      useFactory: (redisClient: Redis) => {
        return new AccountLockoutService(redisClient);
      },
      inject: ['REDIS_CLIENT'],
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    AccountLockoutService,
    JwtModule, // Export JwtModule to make JwtService available to other modules
  ],
})
export class AuthModule {}

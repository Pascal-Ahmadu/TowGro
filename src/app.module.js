"use strict";
import { DispatchModule } from './dispatch/dispatch.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentModule } from './payment/payment.module';
import { TrackingModule } from './tracking/tracking.module';
import { ApiGatewayModule } from './api-gateway/api-gateway.module';
import { ProfileModule } from './profile/profile.module';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
// src/app.module.ts
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const ioredis_1 = require("@nestjs-modules/ioredis");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // 1. Load .env and validate required vars
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.development.local', '.env.development', '.env'],
                validationOptions: { allowUnknown: false, forbidNonWhitelisted: true },
            }), // :contentReference[oaicite:0]{index=0}
            // 2. Database connection (async so we can inject ConfigService)
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (cfg) => ({
                    type: 'postgres',
                    host: cfg.get('DB_HOST'),
                    port: cfg.get('DB_PORT'),
                    username: cfg.get('DB_USER'),
                    password: cfg.get('DB_PASS'),
                    database: cfg.get('DB_NAME'),
                    entities: [__dirname + '/**/*.entity{.ts,.js}'],
                    synchronize: cfg.get('DB_SYNC'), // turn off in prod
                }),
            }), // :contentReference[oaicite:1]{index=1}
            // 3. Redis client for refresh‑token storage
            ioredis_1.RedisModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (cfg) => ({
                    type: 'single',
                    url: cfg.get('REDIS_URL'),
                }),
            }),
            // 4. Feature modules
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
        ],
    })
], AppModule);

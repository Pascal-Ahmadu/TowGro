// src/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './users/entities/user.entity';
import { Transaction } from './payment/entities/transaction.entity';
import { Dispatch } from './dispatch/entities/dispatch.entity';
import { LocationEntity } from './tracking/entities/location.entity';

import { Vehicle } from './vehicles/entities/vehicle.entity';
import { PaymentMethod } from './payment/entities/payment-method.entity';
import { Notification } from './notifications/entities/notification.entity';
import { AuditLogEntity } from './audit/entities/audit-log.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [
    User,
    Transaction,
    Dispatch,
    LocationEntity,
    // Add new entities ↓
    Vehicle,
    PaymentMethod,
    Notification,
    AuditLogEntity
  ],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  migrationsRun: false,
  logging: false,
});

// 👇 Export as default
export default AppDataSource;

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { User } from './src/users/entities/user.entity';
import { Vehicle } from './src/vehicles/entities/vehicle.entity';
import { LocationEntity } from './src/tracking/entities/location.entity';
import { PaymentMethod } from './src/payment/entities/payment-method.entity';
import { Transaction } from './src/payment/entities/transaction.entity';
import { Notification } from './src/notifications/entities/notification.entity';
import { Dispatch } from './src/dispatch/entities/dispatch.entity';
import { AuditLogEntity } from './src/audit/entities/audit-log.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'ep-cool-heart-a46vowsa-pooler.us-east-1.aws.neon.tech',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'neondb_owner',
  password: process.env.DB_PASSWORD || 'npg_1O5EbCwyePXM',
  database: process.env.DB_NAME || 'neondb',
  entities: [
    User,
    Vehicle,
    LocationEntity,
    PaymentMethod,
    Transaction,
    Notification,
    Dispatch,
    AuditLogEntity
  ],
  migrations: [join(__dirname, 'src', 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  synchronize: false,
  ssl: true,
  extra: {
    ssl: {
      rejectUnauthorized: false
    }
  }
});

export default AppDataSource;
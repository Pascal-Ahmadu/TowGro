// src/dispatch/dispatch.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { Dispatch } from './entities/dispatch.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispatch]),
    NotificationsModule,
    PaymentModule, // Add this line to import the PaymentModule if not using global registration
  ],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}

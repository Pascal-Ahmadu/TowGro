// src/tracking/tracking.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { TrackingEvents } from './events/tracking.events';
import { LocationEntity } from './entities/location.entity';
import { TrackingController } from './tracking.controller';
import { JwtModule } from '@nestjs/jwt'; // Add this import
import { AuthModule } from '../auth/auth.module'; // Add this import

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([LocationEntity]),
    JwtModule, // Add JwtModule to imports
    AuthModule, // Import AuthModule to access its providers
  ],
  controllers: [TrackingController],
  providers: [TrackingGateway, TrackingService, TrackingEvents],
  exports: [TrackingGateway, TrackingService] // Combine exports here
})
export class TrackingModule {}
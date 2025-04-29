import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { TrackingModule } from '../tracking/tracking.module';
import { MailService } from '../mail/mail.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { AuthModule } from '../auth/auth.module'; // Import AuthModule
// Or import JwtModule directly if you prefer
// import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    TrackingModule,
    AuthModule, // Add this line to import AuthModule which exports JwtModule
    // Or add JwtModule directly if you prefer
  ],
  providers: [NotificationsService, MailService, TrackingGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}

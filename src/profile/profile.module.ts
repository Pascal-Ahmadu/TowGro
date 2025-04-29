import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // Add this line
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}

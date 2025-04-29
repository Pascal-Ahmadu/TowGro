import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { PaymentModule } from 'src/payment/payment.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => PaymentModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule.forFeature([User])], // Export if other modules need to use this service
})
export class UsersModule {}

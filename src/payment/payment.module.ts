import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Transaction } from './entities/transaction.entity';
import { PaymentMethod } from './entities/payment-method.entity'; // Add this import
import { Paystack } from 'paystack-sdk';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PAYSTACK_CLIENT } from './payment.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, PaymentMethod]), // Add PaymentMethod here
    ConfigModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: PAYSTACK_CLIENT,
      useFactory: (configService: ConfigService) => {
        const secretKey = configService.get<string>('PAYSTACK_SECRET_KEY');
        if (!secretKey) {
          throw new Error('PAYSTACK_SECRET_KEY not configured');
        }
        console.log('Paystack client successfully created');
        return new Paystack(secretKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
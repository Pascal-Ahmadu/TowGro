// entities/dispatch.entity.ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Dispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('decimal')
  pickupLat: number;

  @Column('decimal')
  pickupLng: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled', 'payment_pending', 'payment_completed', 'failed'],
    default: 'pending'
  })
  status: string;

  // Payment-related fields
  @Column({ nullable: true })
  paymentReference?: string;

  @Column({ nullable: true })
  paymentUrl?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  paymentAmount?: number;

  @Column({ nullable: true })
  paymentInitiatedAt?: Date;

  @Column({ nullable: true })
  paymentVerifiedAt?: Date;

  // User relation (if needed)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user?: User;
}
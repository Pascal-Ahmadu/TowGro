import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  content: string;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  readAt: Date;
}

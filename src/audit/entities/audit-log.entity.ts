import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @Column()
  @Index()
  resource: string;

  @Column({ nullable: true })
  @Index()
  resourceId: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column('timestamp')
  @Index()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}

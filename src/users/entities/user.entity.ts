import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

// First define the enum outside the class
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  SUPPORT = 'support'
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    unique: true,
    nullable: true,
    length: 255,
    transformer: {
      to: (value) => value?.toLowerCase(),
      from: (value) => value
    }
  })
  email: string;

  @Index()
  @Column({ nullable: true })
  phoneNumber: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ default: false })
  isActive: boolean;

  // Add roles column if not already present
  @Column('simple-array', { default: 'user' })
  roles: string[];

  // Add biometric methods column
  @Column('simple-array', { nullable: true })
  biometricMethods: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  dateOfBirth?: Date;

  @Column({ nullable: true })
  governmentId?: string;

  @Column({ nullable: true })
  driverLicense?: string;

  // Add this property to your existing User entity
  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  twoFactorSecret: string;

  @Column({ nullable: true })
  tempTwoFactorSecret: string;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true })
  avatarUrl?: string;  // Add this property

  @Column({ type: 'json', nullable: true })
  preferences?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
}
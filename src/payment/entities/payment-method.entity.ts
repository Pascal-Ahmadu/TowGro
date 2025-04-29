import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  lastFour: string;

  @Column()
  brand: string;

  @Column()
  encryptedData: string; // Stores encrypted card details

  @Column({ type: 'timestamp' })
  createdAt: Date;
}
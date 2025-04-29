// src/tracking/entities/location.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('vehicle_locations')
export class LocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  vehicleId: string;

  @Column()
  @Index()
  dispatchId: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  speed: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  bearing: number;

  @Column('decimal', { precision: 10, scale: 5, default: 0 })
  distanceTraveled: number;

  // Add vehicle identification fields
  @Column({ nullable: true })
  registrationNumber?: string;
  
  @Column({ nullable: true })
  plateNumber?: string;
  
  @Column({ nullable: true })
  vehicleColor?: string;
  
  @Column({ nullable: true })
  vehicleMake?: string;
  
  @Column({ nullable: true })
  vehicleDescription?: string;

  @Column('timestamp')
  @Index()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
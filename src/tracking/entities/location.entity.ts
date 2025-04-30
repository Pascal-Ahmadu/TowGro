// src/tracking/entities/location.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('vehicle_locations')
export class LocationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  vehicleId: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  speed: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  bearing: number;

  @Column('decimal', { precision: 10, scale: 5, default: 0 })
  distanceTraveled: number;

  // Add vehicle identification fields with explicit types
  @Column({ type: 'varchar', length: 255, nullable: true })
  registrationNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plateNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehicleColor?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicleMake?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  vehicleDescription?: string;

  @Column('timestamp')
  @Index()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}

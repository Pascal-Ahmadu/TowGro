// src/tracking/dto/tracking.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  IsUUID,
} from 'class-validator';

export class JoinDispatchDto {
  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}

export class UpdateLocationDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsNumber()
  @Min(0)
  speed: number;

  @IsNumber()
  @IsNotEmpty()
  timestamp: number;

  @IsNumber()
  @Min(0)
  @Max(360)
  bearing?: number;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsString()
  @IsOptional()
  plateNumber?: string;

  @IsString()
  @IsOptional()
  vehicleColor?: string;

  @IsString()
  @IsOptional()
  vehicleMake?: string;

  @IsString()
  @IsOptional()
  vehicleDescription?: string;

  @IsNumber()
  @IsOptional()
  distanceTraveled?: number;

  @IsNumber()
  @IsOptional()
  etaSeconds?: number;
}

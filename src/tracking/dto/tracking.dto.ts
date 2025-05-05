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

// Add this import at the top
import { ApiProperty } from '@nestjs/swagger';

export class JoinDispatchDto {
  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}

export class UpdateLocationDto {
  @ApiProperty({
    example: 'a3e8b4c7-2f5d-4912-950c-8f1234567890',
    description: 'UUID of the vehicle'
  })
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({
    example: 'b5f9d3a7-1c8e-4b6a-9f0d-2e7c8d4f6a1b',
    description: 'UUID of the dispatch'
  })
  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @ApiProperty({
    example: 40.7128,
    description: 'Current latitude coordinate'
  })
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
  @ApiProperty({
    example: 150.4,
    description: 'Total distance traveled in meters',
    required: false
  })
  @IsNumber()
  @IsOptional()
  distanceTraveled?: number;

  @IsNumber()
  @IsOptional()
  etaSeconds?: number;

 
}

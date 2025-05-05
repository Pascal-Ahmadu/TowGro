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
  @ApiProperty({
    example: 'b5f9d3a7-1c8e-4b6a-9f0d-2e7c8d4f6a1b',
    description: 'UUID of the dispatch to join'
  })
  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @ApiProperty({
    example: 'a3e8b4c7-2f5d-4912-950c-8f1234567890',
    description: 'ID of the vehicle joining the dispatch'
  })
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

  @ApiProperty({
    example: -74.0060,
    description: 'Current longitude coordinate'
  })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({
    example: 45.5,
    description: 'Current speed in km/h',
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  speed: number;

  @ApiProperty({
    example: 1718901234567,
    description: 'Unix timestamp in milliseconds'
  })
  @IsNumber()
  @IsNotEmpty()
  timestamp: number;

  @ApiProperty({
    example: 90,
    description: 'Direction in degrees (0-360)',
    required: false,
    minimum: 0,
    maximum: 360
  })
  @IsNumber()
  @Min(0)
  @Max(360)
  bearing?: number;

  @ApiProperty({
    example: 'ABC123456',
    description: 'Vehicle registration number',
    required: false
  })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty({
    example: 'ABC-123',
    description: 'License plate number',
    required: false
  })
  @IsString()
  @IsOptional()
  plateNumber?: string;

  @ApiProperty({
    example: 'Blue',
    description: 'Color of the vehicle',
    required: false
  })
  @IsString()
  @IsOptional()
  vehicleColor?: string;

  @ApiProperty({
    example: 'Toyota',
    description: 'Manufacturer of the vehicle',
    required: false
  })
  @IsString()
  @IsOptional()
  vehicleMake?: string;

  @ApiProperty({
    example: 'Sedan',
    description: 'Additional vehicle details',
    required: false
  })
  @IsString()
  @IsOptional()
  vehicleDescription?: string;

  @ApiProperty({
    example: 150.4,
    description: 'Total distance traveled in meters',
    required: false
  })
  @IsNumber()
  @IsOptional()
  distanceTraveled?: number;

  @ApiProperty({
    example: 300,
    description: 'Estimated time of arrival in seconds',
    required: false
  })
  @IsNumber()
  @IsOptional()
  etaSeconds?: number;
}

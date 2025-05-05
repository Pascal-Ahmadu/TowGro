import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsLatitude,
  IsLongitude,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a new dispatch request
 */
export class CreateDispatchDto {
  @ApiProperty({
    description: 'UUID of the user requesting the dispatch',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true
  })
  @IsUUID()
  @IsNotEmpty()
  readonly userId: string;

  @ApiProperty({
    description: 'Latitude coordinate for pickup location',
    example: 40.7128,
  })
  @IsNumber()
  @IsLatitude()
  @IsNotEmpty()
  readonly pickupLat: number;

  @ApiProperty({
    description: 'Longitude coordinate for pickup location',
    example: -74.006,
  })
  @IsNumber()
  @IsLongitude()
  @IsNotEmpty()
  readonly pickupLng: number;

  @ApiProperty({
    description: 'Vehicle type required for dispatch',
    enum: ['flatbed', 'tow'],
    example: 'flatbed',
    required: true
  })
  @IsEnum(['flatbed', 'tow'], {
    message: 'Vehicle type must be either flatbed or tow',
  })
  @IsNotEmpty()
  readonly vehicleType: 'flatbed' | 'tow';
}

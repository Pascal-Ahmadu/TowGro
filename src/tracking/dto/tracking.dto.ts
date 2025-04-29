// src/tracking/dto/tracking.dto.ts
import { IsNotEmpty, IsNumber, IsString, IsOptional, Min, Max, IsUUID  } from 'class-validator';


export class JoinDispatchDto {
  @IsUUID()
  @IsNotEmpty()
  dispatchId: string;

  @IsString()
  @IsNotEmpty()
  vehicleId: string;
}

export class UpdateLocationDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsString()
  @IsNotEmpty()
  dispatchId: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // For backward compatibility with external systems
  // These getters/setters allow the DTO to work with either naming convention
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  get lat(): number {
    return this.latitude;
  }

  set lat(value: number) {
    this.latitude = value;
  }

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  get lng(): number {
    return this.longitude;
  }

  set lng(value: number) {
    this.longitude = value;
  }

  @IsNumber()
  @Min(0)
  speed: number;

  @IsNumber()
  @IsOptional()
  bearing?: number;

  @IsNumber()
  timestamp: number;

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

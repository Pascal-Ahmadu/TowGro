import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACE_ID = 'faceId'
}

export class BiometricRegisterDto {
  @ApiProperty({
    description: 'Unique identifier for the biometric data (hash or token generated by client)',
    example: 'a1b2c3d4e5f6g7h8i9j0',
    required: true
  })
  @IsNotEmpty({ message: 'Biometric ID is required' })
  @IsString()
  biometricId: string;

  @ApiProperty({
    description: 'Type of biometric method',
    enum: BiometricType,
    example: 'fingerprint',
    required: true
  })
  @IsEnum(BiometricType, { message: 'Type must be either fingerprint or faceId' })
  type: BiometricType;
}
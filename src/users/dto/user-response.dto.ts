import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'Unique identifier of the user', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'User phone number', example: '1234567890', required: false })
  phoneNumber: string;

  @ApiProperty({ description: 'Whether the user account is active', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'When the user was created', example: '2023-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'When the user was last updated', example: '2023-01-01T00:00:00Z' })
  updatedAt: Date;
}
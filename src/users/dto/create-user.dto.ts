// src/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsMobilePhone,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: true
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User phone number (digits only)',
    example: '1234567890',
    required: false
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'securePassword123',
    required: true,
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

@ApiProperty({
  description: 'User email address (required if phone number not provided)',
  example: 'user@example.com',
  required: false
})
@ValidateIf((o) => !o.phoneNumber)
@IsEmail({}, { message: 'Valid email address is required' })
@IsOptional()
email?: string;

@ApiProperty({
  description: 'User phone number (required if email not provided)',
  example: '+1234567890',
  required: false
})
@ValidateIf((o) => !o.email)
@IsMobilePhone(
  'en-US',
  {},
  { message: 'Valid phone number required' }
)
@IsOptional()
phoneNumber?: string;

@ApiProperty({
  description: 'User password',
  example: 'StrongP@ssw0rd',
  required: true,
  minLength: 8
})
@IsString()
@MinLength(8, { message: 'Password must be at least 8 characters long' })
@Matches(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  {
    message:
      'Password too weak: must include uppercase, lowercase, number, and special character',
  },
)
password: string;
}

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

export class CreateUserDto {
  @ValidateIf((o) => !o.phoneNumber)
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsMobilePhone(
    'en-US',
    {},
    { message: 'Phone number must be a valid mobile number' },
  )
  @IsOptional()
  phoneNumber?: string;

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

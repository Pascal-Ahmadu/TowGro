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
  @IsEmail({}, { message: 'Valid email address is required' })
  @IsOptional()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsMobilePhone(
    'en-US',
    {},
    { message: 'Valid phone number required' }
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

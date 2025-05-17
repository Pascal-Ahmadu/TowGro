import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token received via email',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: true
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

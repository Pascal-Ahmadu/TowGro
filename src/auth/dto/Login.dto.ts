const { IsString, MinLength } = require('class-validator');
const { ApiProperty } = require('@nestjs/swagger');

export class LoginDto {
  @ApiProperty({
    description: 'Email or phone number for login',
    example: 'user@example.com or +1234567890',
    required: true
  })
  @IsString()
  identifier;

  @ApiProperty({
    description: 'Password (min 8 characters)',
    minLength: 8,
    example: 'Str0ngP@ss!',
    required: true
  })
  @IsString()
  @MinLength(8)
  password;
}

module.exports = LoginDto;
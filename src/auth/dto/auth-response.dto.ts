import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ 
    description: 'JWT access token for API authorization',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'Refresh token used to obtain new access tokens',
    example: '7c4d0e7f-c895-4b31-8644-7e10e7d9f915'
  })
  refreshToken: string;
}
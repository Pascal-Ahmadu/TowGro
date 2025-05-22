import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Delete,
  Request,
  ParseEnumPipe,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JWTAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/Login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiometricRegisterDto } from './dto/biometric-register.dto';
import { BiometricAuthenticateDto } from './dto/biometric-authenticate.dto';
import { BiometricType } from './dto/biometric-register.dto'; // Or the correct path to your enum

@Controller('auth')
@ApiTags('auth')
@Throttle({
  default: { limit: 10, ttl: 60000 },
})
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService, // Add this dependency
  ) {}

  @Post('login')
  @UseGuards(LocalAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto) {
    // Check if user exists before attempting validation
    const user = await this.usersService.findByEmailOrPhoneNumber(loginDto.identifier);
    if (!user) {
      throw new HttpException(
        {
          errorType: 'USER_NOT_FOUND',
          message: 'No user with that email exists'
        },
        HttpStatus.NOT_FOUND
      );
    }
    return this.authService.validateUser(loginDto.identifier, loginDto.password);
  }

  @Post('refresh')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ 
    status: 200, 
    description: 'Token refreshed successfully',
    schema: {
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req) {
    return this.authService.refreshToken(req.user.id, dto.refreshToken);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {}

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleLoginRedirect(@Req() req) {
    return this.authService.login(req.user);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 201, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    // Check if user exists before sending reset email
    const user = await this.usersService.findByEmailOrPhoneNumber(forgotPasswordDto.email);
    if (!user) {
      throw new HttpException(
        {
          errorType: 'USER_NOT_FOUND',
          message: 'No user with that email exists'
        },
        HttpStatus.NOT_FOUND
      );
    }
    return this.authService.sendPasswordResetToken(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset user password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('register')
  @Throttle({
    default: { limit: 3, ttl: 60000 }, // 3 requests per minute for registration
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Get('debug/user-exists/:email')
  async checkUserExists(@Param('email') email: string) {
    const user = await this.usersService.findByEmailOrPhoneNumber(email);
    if (!user) {
      throw new HttpException(
        {
          errorType: 'USER_NOT_FOUND',
          message: 'No user with that email exists'
        },
        HttpStatus.NOT_FOUND
      );
    }
    return { exists: !!user, email };
  }

  @Post('biometric/register')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ 
    summary: 'Register a biometric method',
    description: 'Register a biometric authentication method for the authenticated user. The biometricId should be a secure hash or token generated by the client device.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Biometric method registered successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'fingerprint registered successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT token required' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid biometric data' })
  async registerBiometric(
    @Req() req,
    @Body() data: BiometricRegisterDto, 
  ) {
    return this.authService.registerBiometric(
      req.user.id,
      data.biometricId,
      data.type,
    );
  }

  @Post('biometric/authenticate')
  @ApiOperation({ 
    summary: 'Authenticate with biometrics',
    description: 'Authenticate a user using their registered biometric data (fingerprint or faceId)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Authentication successful',
    schema: {
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        user: { 
          type: 'object',
          properties: {
            id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            email: { type: 'string', example: 'user@example.com' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid biometric data' })
  async authenticateWithBiometric(@Body() data: BiometricAuthenticateDto) {
    return this.authService.authenticateWithBiometric(
      data.userId,
      data.biometricId,
      data.type,
    );
  }

  @Delete('biometric/:type')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ 
    summary: 'Remove a biometric method',
    description: 'Remove a registered biometric authentication method for the authenticated user. Valid types are "fingerprint" or "faceId".'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Biometric method removed',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'fingerprint removed successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Not Found - Biometric method not registered' })
  async removeBiometric(
    @Req() req,
    @Param('type', new ParseEnumPipe(BiometricType)) type: BiometricType,
  ) {
    return this.authService.removeBiometric(req.user.id, type);
  }

  @Get('biometric/methods')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ 
    summary: 'Get available biometric methods',
    description: 'Retrieves all biometric authentication methods registered for the authenticated user.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of available methods',
    schema: {
      properties: {
        methods: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['fingerprint', 'faceId'],
                example: 'fingerprint' 
              },
              registeredAt: { 
                type: 'string', 
                format: 'date-time',
                example: '2023-06-15T14:30:00Z' 
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT token required' })
  async getBiometricMethods(@Req() req) {
    return this.authService.getBiometricMethods(req.user.id);
  }

  @Post('logout')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req) {
    // Assuming JWTAuthGuard adds the user object to the request
    // and that user object has an 'id' property.
    return this.authService.logout(req.user.id);
  }
}
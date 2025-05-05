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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
@Throttle({
  default: { limit: 10, ttl: 60000 },
})
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService, // Add this dependency
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() loginDto: LoginDto) {
    // Directly use the DTO for validation
    return this.authService.validateUser(loginDto.identifier, loginDto.password);
  }

  @Post('refresh')
  @UseGuards(JWTAuthGuard)
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

  // Add this to your AuthController
  @Get('debug/user-exists/:email')
  async checkUserExists(@Param('email') email: string) {
    const user = await this.usersService.findByEmailOrPhoneNumber(email);
    return { exists: !!user, email };
  }

  // Add these endpoints to your existing AuthController

  @Post('biometric/register')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Register a biometric method' })
  @ApiResponse({ status: 201, description: 'Biometric method registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerBiometric(
    @Req() req,
    @Body() data: { biometricId: string; type: 'fingerprint' | 'faceId' },
  ) {
    return this.authService.registerBiometric(
      req.user.id,
      data.biometricId,
      data.type,
    );
  }

  @Post('biometric/authenticate')
  @ApiOperation({ summary: 'Authenticate with biometrics' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async authenticateWithBiometric(
    @Body()
    data: {
      userId: string;
      biometricId: string;
      type: 'fingerprint' | 'faceId';
    },
  ) {
    return this.authService.authenticateWithBiometric(
      data.userId,
      data.biometricId,
      data.type,
    );
  }

  @Delete('biometric/:type')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Remove a biometric method' })
  @ApiResponse({ status: 200, description: 'Biometric method removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeBiometric(
    @Req() req,
    @Param('type') type: 'fingerprint' | 'faceId',
  ) {
    return this.authService.removeBiometric(req.user.id, type);
  }

  @Get('biometric/methods')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Get available biometric methods' })
  @ApiResponse({ status: 200, description: 'List of available methods' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBiometricMethods(@Req() req) {
    return this.authService.getBiometricMethods(req.user.id);
  }
}

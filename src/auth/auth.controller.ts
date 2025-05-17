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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('auth') // This line might already exist, ensure it's there
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
  @Throttle({
    default: { limit: 5, ttl: 60000 }, // 5 requests per minute for login
  })
  @UseGuards(LocalAuthGuard)
  async login(@Body() loginDto: LoginDto, @Req() req) {
    // The LocalAuthGuard validates credentials before this executes
    // loginDto is available here but typically not needed since req.user contains the authenticated user
    return this.authService.login(req.user);
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
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Limit to 3 requests per minute
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendPasswordResetToken(dto.email);
  }

  @Post('reset-password')
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

  @Post('logout')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  @ApiBearerAuth() // If you are using Bearer token authentication
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req) {
    // Assuming JWTAuthGuard adds the user object to the request
    // and that user object has an 'id' property.
    return this.authService.logout(req.user.id);
  }
}

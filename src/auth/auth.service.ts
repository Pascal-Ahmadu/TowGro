import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.logger.log('AuthService initialized');
  }

  async validateUser(identifier: string, password: string): Promise<any> {
    this.logger.debug(`Validating user with identifier: ${identifier}`);
    const user = await this.usersService.findByEmailOrPhoneNumber(identifier);

    if (!user) {
      this.logger.debug(`No user found with identifier: ${identifier}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.debug(`Invalid password for user: ${identifier}`);
      return null;
    }

    this.logger.debug(`User validated successfully: ${identifier}`);
    const { password: _, ...result } = user;
    return result;
  }

  async login(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
    };

    const accessExpires = this.config.get('JWT_ACCESS_EXPIRES');
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: accessExpires || '1h',
    });

    const refreshExpires = this.config.get('JWT_REFRESH_EXPIRES');
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: refreshExpires || '7d',
      },
    );

    const refreshExpiresSeconds = parseInt(
      this.config.get('JWT_REFRESH_EXPIRES_SEC') || '604800',
    );
    await this.redis.set(
      `refresh_token:${user.id}`,
      refreshToken,
      'EX',
      refreshExpiresSeconds,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
    };
  }

  async logout(userId: string) {
    // Delete the refresh token from Redis
    await this.redis.del(`refresh_token:${userId}`);
    return { message: 'Logged out successfully' };
  }

  // In refreshToken method
  async refreshToken(userId: string, refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'), // Changed from configService
      });

      if (decoded.sub !== userId) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token exists in Redis
      const storedToken = await this.redis.get(`refresh_token:${userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        // If token doesn't match what's stored, it might be a reuse attempt
        // Invalidate all tokens for this user as a security measure
        await this.redis.del(`refresh_token:${userId}`);
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      // Get user
      const user = await this.usersService.findById(userId);

      // Generate new tokens (token rotation)
      const tokens = await this.login(user);

      // Invalidate the old refresh token immediately
      await this.redis.del(`refresh_token:${userId}`);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async sendPasswordResetToken(email: string) {
    this.logger.debug(`Generating password reset token for email: ${email}`);
    
    // Find the user by email
    const user = await this.usersService.findByEmailOrPhoneNumber(email);
    
    // For security reasons, always return the same response whether user exists or not
    if (!user) {
      this.logger.debug(`No user found with email: ${email}`);
      return { message: 'If your email is registered, you will receive a password reset link' };
    }
    
    // Generate a JWT token with short expiration
    const token = this.jwtService.sign(
      { 
        sub: user.id, 
        email: user.email,
        type: 'password-reset' 
      },
      {
        secret: this.config.get('JWT_RESET_SECRET'),
        expiresIn: '15m' // Short expiration for security
      }
    );
    
    // Store the token in Redis with expiration
    await this.redis.set(
      `password_reset:${user.id}`,
      token,
      'EX',
      900 // 15 minutes in seconds
    );
    
    // In a real application, you would send this token via email
    // For example:
    // await this.mailService.sendPasswordResetEmail(user.email, token);
    
    this.logger.debug(`Password reset token generated for user: ${user.id}`);
    
    return { 
      message: 'If your email is registered, you will receive a password reset link',
      // For development purposes only, you might want to return the token directly
      // Remove this in production
      token: token 
    };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.config.get('JWT_RESET_SECRET'), // Changed
      });

      if (decoded.type !== 'password-reset') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if token exists in Redis
      const storedToken = await this.redis.get(`password_reset:${decoded.sub}`);
      if (!storedToken || storedToken !== token) {
        throw new UnauthorizedException('Password reset token used or expired');
      }

      // Update user password
      await this.usersService.updateUser(decoded.sub, {
        password: newPassword,
      });

      // Delete the used token
      await this.redis.del(`password_reset:${decoded.sub}`);

      return { message: 'Password updated successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async verifyEmail(token: string) {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.config.get('JWT_EMAIL_VERIFY_SECRET'), // Changed
      });

      if (decoded.type !== 'email-verification') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Mark email as verified
      await this.usersService.updateUser(decoded.sub, { isActive: true });

      return { message: 'Email verified successfully' };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async validateOAuthLogin(email: string) {
    // Find user by email
    let user = await this.usersService.findByEmailOrPhoneNumber(email);

    if (!user) {
      // Create new user if doesn't exist
      // Generate a random secure password for OAuth users
      const randomPassword =
        Math.random().toString(36).slice(-10) +
        Math.random().toString(36).slice(-10);

      user = await this.usersService.createUser({
        email,
        password: randomPassword,
      });

      // Set user as active since OAuth users are typically pre-verified
      await this.usersService.updateUser(user.id, { isActive: true });
    }

    // Return user data for JWT token generation
    const { password: _, ...result } = user;
    return result;
  }

  // Add this method to the AuthService class
  async register(createUserDto: any) {
    try {
      const user = await this.usersService.createUser({
        email: createUserDto.email,
        phoneNumber: createUserDto.phoneNumber,
        password: createUserDto.password,
      });

      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a biometric identifier for a user
   * @param userId The user's ID
   * @param biometricId The biometric identifier from the client
   * @param type The type of biometric (fingerprint, faceId)
   * @returns Success message
   */
  async registerBiometric(
    userId: string,
    biometricId: string,
    type: 'fingerprint' | 'faceId',
  ) {
    try {
      this.logger.debug(`Registering ${type} for user: ${userId}`);

      // Get the user to verify they exist
      const user = await this.usersService.findById(userId);

      // Hash the biometric ID before storing it
      // This adds an extra layer of security
      const hashedBiometricId = await bcrypt.hash(biometricId, 10);

      // Store the biometric ID in Redis with an expiration
      // Format: biometric:{type}:{userId} = hashedBiometricId
      await this.redis.set(
        `biometric:${type}:${userId}`,
        hashedBiometricId,
        'EX',
        // Store for 90 days (typical for biometric credentials)
        60 * 60 * 24 * 90,
      );

      // Update user record to indicate they have this biometric type registered
      // This requires adding a biometricMethods field to your User entity
      await this.usersService.updateUser(userId, {
        biometricMethods: [...(user.biometricMethods || []), type],
      });

      return {
        success: true,
        message: `${type} registered successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to register biometric: ${error.message}`);
      throw error;
    }
  }

  /**
   * Authenticate a user using biometrics
   * @param userId The user's ID
   * @param biometricId The biometric identifier from the client
   * @param type The type of biometric (fingerprint, faceId)
   * @returns Authentication tokens
   */
  async authenticateWithBiometric(
    userId: string,
    biometricId: string,
    type: 'fingerprint' | 'faceId',
  ) {
    try {
      this.logger.debug(`Authenticating with ${type} for user: ${userId}`);

      // Get the user
      const user = await this.usersService.findById(userId);

      // Check if user has registered this biometric method
      if (!user.biometricMethods?.includes(type)) {
        throw new UnauthorizedException(`No ${type} registered for this user`);
      }

      // Get the stored biometric hash
      const storedHash = await this.redis.get(`biometric:${type}:${userId}`);

      if (!storedHash) {
        throw new UnauthorizedException(
          `${type} credentials expired or not found`,
        );
      }

      // Verify the biometric ID
      const isValid = await bcrypt.compare(biometricId, storedHash);

      if (!isValid) {
        throw new UnauthorizedException('Invalid biometric credentials');
      }

      // Generate authentication tokens
      return this.login(user);
    } catch (error) {
      this.logger.error(`Biometric authentication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a registered biometric method
   * @param userId The user's ID
   * @param type The type of biometric to remove
   * @returns Success message
   */
  async removeBiometric(userId: string, type: 'fingerprint' | 'faceId') {
    try {
      this.logger.debug(`Removing ${type} for user: ${userId}`);

      // Get the user
      const user = await this.usersService.findById(userId);

      // Remove from Redis
      await this.redis.del(`biometric:${type}:${userId}`);

      // Update user record
      if (user.biometricMethods?.includes(type)) {
        await this.usersService.updateUser(userId, {
          biometricMethods: user.biometricMethods.filter(
            (method) => method !== type,
          ),
        });
      }

      return {
        success: true,
        message: `${type} removed successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to remove biometric: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available biometric methods for a user
   * @param userId The user's ID
   * @returns List of registered biometric methods
   */
  async getBiometricMethods(userId: string) {
    try {
      const user = await this.usersService.findById(userId);
      return {
        methods: user.biometricMethods || [],
      };
    } catch (error) {
      this.logger.error(`Failed to get biometric methods: ${error.message}`);
      throw error;
    }
  }
}

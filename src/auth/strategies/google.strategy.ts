import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  
  constructor(private configService: ConfigService) {
    const clientID = configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.getOrThrow<string>('GOOGLE_CALLBACK_URL');

    // Enhanced validation
    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error('Google OAuth credentials not loaded');
    }

    super({
      clientID: clientID.trim(),
      clientSecret: clientSecret.trim(),
      callbackURL: callbackURL.trim(),
      scope: ['email', 'profile'],
    });
    
    this.logger.log(`Google OAuth initialized with clientID: ${clientID.substring(0,12)}...`);
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
    done(null, profile);
  }
}
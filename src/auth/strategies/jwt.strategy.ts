import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET'),
        });
    }

    async validate(payload: { sub: string }) {
        // Get the complete user with roles
        const user = await this.usersService.findByEmailOrPhoneNumber(payload.sub);
        
        // Return user with roles for use in guards
        return {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            roles: user.roles || ['user'], // Default to 'user' role if none specified
        };
    }
}
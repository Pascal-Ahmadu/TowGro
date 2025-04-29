import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiGatewayService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  getApiInfo() {
    const version = this.configService.get<string>('API_VERSION', '1.0.0');
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    
    return {
      name: 'Auth Service API Gateway',
      version,
      environment,
      timestamp: new Date().toISOString(),
    };
  }

  getRoutes() {
    return {
      auth: {
        login: '/auth/login',
        register: '/auth/register',
        refresh: '/auth/refresh',
      },
      payments: {
        initialize: '/payments',
        verify: '/payments/verify/:reference',
        refund: '/payments/refund',
      },
      tracking: {
        updateLocation: '/tracking/location',
        getLatestLocation: '/tracking/vehicle/:vehicleId/latest',
        getLocationHistory: '/tracking/vehicle/:vehicleId/history',
      },
    };
  }

  /**
   * Authenticates a user with the provided credentials
   * @param credentials User credentials (username and password)
   * @returns Authentication response with tokens
   */
  async authenticate(credentials: { username: string; password: string }) {
    try {
      // Call the auth service login endpoint
      const authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
      const response = await firstValueFrom(
        this.httpService.post(`${authServiceUrl}/auth/login`, {
          identifier: credentials.username,
          password: credentials.password,
        })
      );
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw error;
    }
  }
}
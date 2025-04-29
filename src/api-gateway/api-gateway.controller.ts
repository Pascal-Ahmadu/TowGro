import { Controller, Get, Post, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiGatewayService } from './api-gateway.service';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ApiAuthGuard } from './guards/api-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('api-gateway')
@Controller('api')  // This controller handles /api/* routes
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(ApiAuthGuard)
@ApiSecurity('bearer')
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Get()
  // Removed @Public() decorator
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns API information and available routes' 
  })
  getApiInfo() {
    return {
      ...this.apiGatewayService.getApiInfo(),
      routes: this.apiGatewayService.getRoutes(),
    };
  }

  // Remove this duplicate health endpoint ❌
  // @Get('health')
  // healthCheck() {
  //   return { status: 'ok' };
  // }
  
  @Get('routes')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get available API routes' })
  @ApiResponse({ status: 200, description: 'Returns available API routes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRoutes() {
    return this.apiGatewayService.getRoutes();
  }

  @Post('auth/login')
  @Public()
  @ApiOperation({ summary: 'Authenticate user and get token' })
  @ApiResponse({ status: 200, description: 'Returns JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() credentials: { username: string; password: string }) {
    return this.apiGatewayService.authenticate(credentials);
  }
}
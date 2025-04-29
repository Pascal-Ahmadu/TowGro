import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete, Patch } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';
import { MetricsService } from '../monitoring/metrics.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Controller('admin')
@UseGuards(JWTAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('users')
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(Number(page), Number(limit));
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post('users')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Get('metrics/users')
  async getUserMetrics() {
    // Use the getUserStatistics method that already exists in UsersService
    const stats = await this.usersService.getUserStatistics();
    
    return {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeToday,
      newUsersToday: stats.verifiedUsers, // Using verifiedUsers as a substitute, or implement a proper method
    };
  }

  @Get('metrics/auth')
  async getAuthMetrics() {
    // Use methods that exist in MetricsService or provide default values
    return {
      loginAttempts: this.metricsService.getMetric('login_attempts') || 0,
      successfulLogins: this.metricsService.getMetric('successful_logins') || 0,
      failedLogins: this.metricsService.getMetric('failed_logins') || 0,
    };
  }

  @Get('metrics/system')
  async getSystemMetrics() {
    // Use methods that exist in MetricsService or provide default values
    return {
      httpRequests: this.metricsService.getMetric('http_requests') || 0,
      averageResponseTime: this.metricsService.getMetric('response_time_avg') || 0,
      errorRate: this.metricsService.getMetric('error_rate') || 0,
    };
  }
}
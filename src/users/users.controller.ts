import { 
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Request,
  Logger, 
  Query, 
  DefaultValuePipe, 
  ParseIntPipe, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  UseInterceptors,  // Add this
  UploadedFile      // Add this
} from '@nestjs/common';

// Update JwtAuthGuard import (line 15)
import { JWTAuthGuard } from '../auth/guards/jwt-auth.guard'; // Changed to JWTAuthGuard
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/update-profile.dto'; // You need to create this DTO
export { UpdateUserDto } from './dto/update-user.dto';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JWTAuthGuard)  // Add guard at controller level
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CacheKey('all-users')
  @CacheTTL(30) // 30 seconds
  async findAll(
    @Query('identifier') identifier?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10
  ): Promise<User | { users: User[], total: number }> {
    this.logger.log(`Finding users: page ${page}, limit ${limit}`);
    
    // If identifier is provided, find by email or phone
    if (identifier) {
      return this.usersService.findByEmailOrPhoneNumber(identifier);
    }
    
    // Otherwise, return paginated list of users
    return this.usersService.findAll(page, limit);
  }

  @Get(':id')
  @CacheKey('user-by-id')
  @CacheTTL(30)
  async findById(@Param('id') id: string): Promise<User> {
    this.logger.log(`Finding user by ID: ${id}`);
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    this.logger.log('Creating user');
    return this.usersService.createUser(createUserDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    this.logger.log(`Updating user: ${id}`);
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting user: ${id}`);
    await this.usersService.deleteUser(id);
  }

  // Add these endpoints to your UsersController
  
  @Patch('profile')
  @UseGuards(JWTAuthGuard)
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }
  
  @Get('profile')
  @UseGuards(JWTAuthGuard)  // Fixed casing
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }
  
  @Post('profile/avatar')
  @UseGuards(JWTAuthGuard)  // Fixed casing
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Request() req, @UploadedFile() file) {
    return this.usersService.updateAvatar(req.user.id, file);
  }
}
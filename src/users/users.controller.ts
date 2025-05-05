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
  UseInterceptors,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';

// Updated JwtAuthGuard import
import { JWTAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateProfileDto } from './dto/update-profile.dto';
export { UpdateUserDto } from './dto/update-user.dto';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@Controller('users')
@UseGuards(JWTAuthGuard) // Add guard at controller level
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CacheKey('all-users')
  @CacheTTL(30) // 30 seconds
  @ApiOperation({ 
    summary: 'Find user by identifier or get all users',
    description: 'Retrieves a user by their email or phone number identifier, or returns a paginated list of all users.'
  })
  @ApiQuery({
    name: 'identifier',
    required: false,
    description: 'Email address or phone number of the user to find',
    example: 'user@example.com'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 10
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User found or list of users returned',
    schema: {
      oneOf: [
        {
          properties: {
            id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            email: { type: 'string', example: 'user@example.com' },
            phoneNumber: { type: 'string', example: '+1234567890' },
            emailVerified: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time', example: '2023-06-15T14:30:00Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2023-06-15T14:30:00Z' }
          }
        },
        {
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  phoneNumber: { type: 'string' },
                  emailVerified: { type: 'boolean' }
                }
              }
            },
            total: { type: 'number', example: 42 }
          }
        }
      ]
    }
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findAll(
    @Query('identifier') identifier?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ): Promise<User | { users: User[]; total: number }> {
    this.logger.log(`Finding users: page ${page}, limit ${limit}`);

    // If identifier is provided, find by email or phone
    if (identifier) {
      const user = await this.usersService.findByEmailOrPhoneNumber(identifier);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }

    // Otherwise, return paginated list of users
    return this.usersService.findAll(page, limit);
  }

  @Get('by-identifier')
  @ApiOperation({ 
    summary: 'Find user by identifier',
    description: 'Retrieves a user by their email or phone number identifier.'
  })
  @ApiQuery({
    name: 'identifier',
    required: true,
    description: 'Email address or phone number of the user to find',
    example: 'user@example.com'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User found',
    schema: {
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        email: { type: 'string', example: 'user@example.com' },
        phoneNumber: { type: 'string', example: '+1234567890' },
        emailVerified: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time', example: '2023-06-15T14:30:00Z' },
        updatedAt: { type: 'string', format: 'date-time', example: '2023-06-15T14:30:00Z' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT token required' })
  async findOne(@Query('identifier') identifier: string): Promise<User> {
    const user = await this.usersService.findByEmailOrPhoneNumber(identifier);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
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

  @Patch('profile')
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Request() req, @UploadedFile() file) {
    return this.usersService.updateAvatar(req.user.id, file);
  }
}
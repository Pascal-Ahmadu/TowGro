import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { v2 as cloudinary } from 'cloudinary';
import { UpdateProfileDto } from './dto/update-profile.dto'; // <-- Add this import
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // Add injection
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  // Add caching layer to Cloudinary uploads
  async uploadDocument(userId: string, file: Express.Multer.File) {
    const cacheKey = `upload:${userId}:${file.originalname}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) return cached;

    const result = await cloudinary.uploader.upload(
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      {
        folder: `documents/${userId}`,
        public_id: `${Date.now()}-${file.originalname}`,
      },
    );

    // Move cache set before return
    await this.cacheManager.set(cacheKey, result, 3600);

    return {
      documentUrl: result.secure_url,
      key: result.public_id,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.usersService.updateUser(userId, {
      dateOfBirth: dto.dateOfBirth,
      governmentId: dto.governmentId,
      driverLicense: dto.driverLicense,
    });
  }
}

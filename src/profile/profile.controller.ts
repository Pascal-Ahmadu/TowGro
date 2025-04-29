import { 
  Controller, 
  Post, 
  Put, 
  UseInterceptors, 
  UploadedFile, 
  Body, 
  Request 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    return this.profileService.uploadDocument(req.user.id, file);
  }

  @Put()
  async updateProfile(@Body() dto: UpdateProfileDto, @Request() req) {
    return this.profileService.updateProfile(req.user.id, dto);
  }
}

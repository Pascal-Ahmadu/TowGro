// src/notifications/dto/create-notification.dto.ts
import { IsEmail, IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  content: string;
  
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  importance?: string;
  
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SendEmailDto {
  @IsEmail()
  to: string;
  
  @IsString()
  subject: string;
  
  @IsOptional()
  @IsString()
  text?: string;
  
  @IsOptional()
  @IsString()
  html?: string;
}

export class SendSmsDto {
  @IsString()
  to: string;
  
  @IsString()
  message: string;  // Changed from body to message to match controller/service usage
}

export class TaskbarNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(['low', 'medium', 'high'])
  urgency: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
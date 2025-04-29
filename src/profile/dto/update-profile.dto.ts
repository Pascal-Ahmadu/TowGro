import { IsDate, IsString, IsOptional, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsDate()
  dateOfBirth: Date;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8,20}$/i)
  governmentId: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8,20}$/i)
  driverLicense: string;
}
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, ApplicationStage } from '@prisma/client';

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: ApplicationStage })
  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Recruiter notes', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Cover letter update', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;
}

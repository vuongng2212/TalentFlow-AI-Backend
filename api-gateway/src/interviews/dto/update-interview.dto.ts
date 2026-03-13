import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewType, InterviewStatus } from '@prisma/client';

export class UpdateInterviewDto {
  @ApiPropertyOptional({ example: '2026-03-20T14:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes',
    minimum: 15,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duration?: number;

  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional({ example: 'https://zoom.us/j/123456' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({ example: 'Candidate did well on system design' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: InterviewStatus })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @ApiPropertyOptional({ description: 'Interviewer user ID' })
  @IsOptional()
  @IsUUID()
  interviewerId?: string;
}

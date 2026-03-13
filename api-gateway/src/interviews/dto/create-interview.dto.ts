import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewType } from '@prisma/client';

export class CreateInterviewDto {
  @ApiProperty({ description: 'Application ID' })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: '2026-03-20T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes',
    default: 60,
    minimum: 15,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duration?: number;

  @ApiProperty({
    enum: InterviewType,
    default: InterviewType.VIDEO,
    example: InterviewType.VIDEO,
  })
  @IsEnum(InterviewType)
  @IsOptional()
  type?: InterviewType;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({ example: 'Focus on system design questions' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Interviewer user ID' })
  @IsOptional()
  @IsUUID()
  interviewerId?: string;
}

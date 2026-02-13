import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, JobStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Full Stack Developer', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'We are looking for an experienced developer...',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ example: 'Remote' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiProperty({
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
    example: EmploymentType.FULL_TIME,
  })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 80000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 120000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  salaryMax?: number;

  @ApiProperty({
    enum: JobStatus,
    default: JobStatus.DRAFT,
    example: JobStatus.DRAFT,
  })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiPropertyOptional({
    example: { skills: ['React', 'Node.js'], experience: '3+ years' },
    description: 'Additional job requirements as JSON',
  })
  @IsOptional()
  requirements?: any;
}

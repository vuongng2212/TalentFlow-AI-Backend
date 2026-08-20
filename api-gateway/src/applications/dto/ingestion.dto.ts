import {
  IsUUID,
  IsEmail,
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngestionDto {
  @ApiProperty({ description: 'Job ID to apply for' })
  @IsUUID()
  @IsNotEmpty()
  jobId: string;

  @ApiProperty({ description: "Candidate's email address" })
  @IsEmail()
  @IsNotEmpty()
  candidateEmail: string;

  @ApiProperty({ description: "Candidate's full name" })
  @IsString()
  @IsNotEmpty()
  candidateName: string;

  @ApiPropertyOptional({
    description: 'Optional cover letter text (extracted from email body)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;

  @ApiPropertyOptional({
    description: 'Optional external email message ID (e.g. Gmail message ID)',
  })
  @IsOptional()
  @IsString()
  externalMessageId?: string;
}

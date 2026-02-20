import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCvDto {
  @ApiProperty({ description: 'Job ID to apply for' })
  @IsUUID()
  @IsNotEmpty()
  jobId: string;

  @ApiPropertyOptional({ description: 'Cover letter text', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;
}

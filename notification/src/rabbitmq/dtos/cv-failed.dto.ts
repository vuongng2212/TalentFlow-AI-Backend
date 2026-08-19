import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

export class CvFailedDto {
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  applicantId?: string;

  @IsEmail()
  @IsNotEmpty()
  applicantEmail!: string;

  @IsString()
  @IsNotEmpty()
  applicantName!: string;

  @IsString()
  @IsNotEmpty()
  jobTitle!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsISO8601()
  @IsNotEmpty()
  failedAt!: string;
}

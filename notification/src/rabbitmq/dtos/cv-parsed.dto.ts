import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

export class CvParsedDto {
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsEmail()
  @IsNotEmpty()
  applicantEmail!: string;

  @IsString()
  @IsNotEmpty()
  applicantName!: string;

  @IsString()
  @IsNotEmpty()
  jobTitle!: string;

  @IsNumber()
  @IsOptional()
  score?: number;

  @IsISO8601()
  @IsNotEmpty()
  parsedAt!: string;
}

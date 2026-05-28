import { IsEmail, IsNotEmpty, IsString, IsISO8601 } from 'class-validator';

export class ApplicationCreatedDto {
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsString()
  @IsNotEmpty()
  jobId!: string;

  @IsString()
  @IsNotEmpty()
  jobTitle!: string;

  @IsString()
  @IsNotEmpty()
  applicantId!: string;

  @IsEmail()
  @IsNotEmpty()
  applicantEmail!: string;

  @IsString()
  @IsNotEmpty()
  applicantName!: string;

  @IsISO8601()
  @IsNotEmpty()
  appliedAt!: string;
}

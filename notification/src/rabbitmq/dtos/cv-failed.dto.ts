import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

/**
 * Consumes the `cv.failed` enriched event published by the API Gateway
 * (see `EnrichedCvFailedEvent` in the api-gateway queue interfaces).
 * Field names are kept in sync with the gateway payload; previously this DTO
 * expected `reason`/`failedAt` which the gateway never sent, causing every
 * event to fail validation and be dropped.
 */
export class CvFailedDto {
  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsString()
  @IsOptional()
  recruiterId?: string;

  @IsString()
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
  @IsOptional()
  errorMessage?: string;

  @IsISO8601()
  @IsOptional()
  timestamp?: string;
}

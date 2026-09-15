import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsISO8601,
} from 'class-validator';

/**
 * Consumes the `cv.parsed` enriched event published by the API Gateway
 * (see `EnrichedCvParsedEvent` in the api-gateway queue interfaces).
 * Field names are kept in sync with the gateway payload; previously this DTO
 * expected `score`/`parsedAt` which the gateway never sent, causing every
 * event to fail validation and be dropped.
 */
export class CvParsedDto {
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

  @IsNumber()
  @IsOptional()
  aiScore?: number;

  @IsISO8601()
  @IsOptional()
  timestamp?: string;
}

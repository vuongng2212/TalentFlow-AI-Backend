import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({
    description: 'The template name (unique within the workspace).',
    example: 'Interview Invitation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'The subject line of the email template.',
    example: 'You are invited to interview',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    description: 'The body of the email template (plain text or Handlebars).',
    example: 'Hello {{candidateName}}, ...',
  })
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Updated subject line.' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Updated body.' })
  @IsString()
  @IsOptional()
  body?: string;
}

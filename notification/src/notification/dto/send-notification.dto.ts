import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EmailTemplateId } from '../../email/email-template';

export enum SendNotificationType {
  EMAIL = 'email',
  APPLICATION_CONFIRMATION = 'application_confirmation',
  INTERVIEW_INVITATION = 'interview_invitation',
  NEW_APPLICATION_HR = 'new_application_hr',
  APPLICATION_RESULT = 'application_result',
}

export enum SendNotificationChannel {
  EMAIL = 'email',
}

export class SendNotificationDto {
  @IsEmail()
  to: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject: string;

  @IsEnum(SendNotificationType)
  type: SendNotificationType;

  @IsOptional()
  @IsEnum(SendNotificationChannel)
  channel?: SendNotificationChannel = SendNotificationChannel.EMAIL;

  @ValidateIf((dto: SendNotificationDto) => !dto.templateId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body?: string;

  @ValidateIf((dto: SendNotificationDto) => !dto.body)
  @IsEnum(EmailTemplateId)
  @IsNotEmpty()
  templateId?: EmailTemplateId;

  @IsOptional()
  @IsObject()
  templateData?: Record<string, unknown>;
}

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';

export enum NotificationType {
  EMAIL = 'email',
  APPLICATION_CONFIRMATION = 'application_confirmation',
  INTERVIEW_INVITATION = 'interview_invitation',
  NEW_APPLICATION_HR = 'new_application_hr',
  APPLICATION_RESULT = 'application_result',
}

export class NotificationSendDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  templateData?: Record<string, unknown>;
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { EmailTemplateId } from '../email/email-template';
import { EmailService } from '../email/email.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import {
  SendNotificationDto,
  SendNotificationType,
} from './dto/send-notification.dto';
import { NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(private readonly emailService: EmailService) {}

  async send(
    dto: SendNotificationDto,
    user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    const templateId = dto.templateId ?? this.resolveTemplateId(dto.type);

    await this.emailService.sendEmail({
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.body ? undefined : templateId,
      templateData: dto.templateData,
    });

    const now = new Date();
    const notification: NotificationEntity = {
      id: randomUUID(),
      userId: user.userId,
      type: dto.type,
      channel: 'email',
      title: dto.subject,
      message: dto.body ?? `Email sent with template ${templateId}`,
      recipient: dto.to,
      subject: dto.subject,
      status: 'sent',
      read: false,
      sentAt: now,
      createdAt: now,
    };

    return this.toResponse(notification);
  }

  getNotificationById(id: string, userId: string): NotificationResponseDto {
    const notification: NotificationEntity = {
      id,
      userId,
      title: 'Sample notification',
      message: `Notification ${id} is available for ${userId}`,
      read: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    return this.toResponse(notification);
  }

  private resolveTemplateId(
    type: SendNotificationType,
  ): EmailTemplateId | undefined {
    const templates: Partial<Record<SendNotificationType, EmailTemplateId>> = {
      [SendNotificationType.APPLICATION_CONFIRMATION]:
        EmailTemplateId.APPLICATION_CONFIRMATION,
      [SendNotificationType.INTERVIEW_INVITATION]:
        EmailTemplateId.INTERVIEW_INVITATION,
      [SendNotificationType.NEW_APPLICATION_HR]:
        EmailTemplateId.NEW_APPLICATION_HR,
      [SendNotificationType.APPLICATION_RESULT]:
        EmailTemplateId.APPLICATION_RESULT,
    };

    return templates[type];
  }

  private toResponse(
    notification: NotificationEntity,
  ): NotificationResponseDto {
    return {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      sentAt: notification.sentAt?.toISOString(),
    };
  }
}

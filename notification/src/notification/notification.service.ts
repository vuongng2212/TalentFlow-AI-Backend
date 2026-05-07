import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { maskPii } from '../common/utils/pii-masker';
import { EmailTemplateId } from '../email/email-template';
import { EmailService } from '../email/email.service';
import {
  ApplicationCreatedEvent,
  CvFailedEvent,
  CvParsedEvent,
  NotificationSendEvent,
} from '../rabbitmq/events';
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

  async sendFromEvent(
    event: NotificationSendEvent,
  ): Promise<{ success: boolean; messageId?: string }> {
    const logger = new Logger(NotificationService.name);
    logger.log(`Processing notification.send event for ${maskPii(event.to)}`);

    const templateId =
      (event.templateId as EmailTemplateId | undefined) ??
      (event.type !== 'email'
        ? this.resolveTemplateId(event.type as SendNotificationType)
        : undefined);

    await this.emailService.sendEmail({
      to: event.to,
      subject: event.subject,
      body: event.body,
      templateId: event.body ? undefined : templateId,
      templateData: event.templateData,
    });

    const now = new Date();
    const notification: NotificationEntity = {
      id: randomUUID(),
      userId: event.userId,
      type: event.type as SendNotificationType,
      channel: 'email',
      title: event.subject,
      message: event.body ?? `Email sent with template ${templateId}`,
      recipient: event.to,
      subject: event.subject,
      status: 'sent',
      read: false,
      sentAt: now,
      createdAt: now,
    };

    logger.log(`sendFromEvent completed, notificationId=${notification.id}`);
    return { success: true, messageId: notification.id };
  }

  async handleApplicationCreated(
    event: ApplicationCreatedEvent,
  ): Promise<{ success: boolean; messageId?: string }> {
    const logger = new Logger(NotificationService.name);
    logger.log(
      `Processing application.created for applicant ${maskPii(event.applicantEmail)}`,
    );

    await this.emailService.sendEmail({
      to: event.applicantEmail,
      subject: `Application Received: ${event.jobTitle}`,
      templateId: EmailTemplateId.APPLICATION_CONFIRMATION,
      templateData: {
        applicantName: event.applicantName,
        jobTitle: event.jobTitle,
      },
    });

    const notification: NotificationEntity = {
      id: randomUUID(),
      userId: event.applicantId,
      type: 'application_confirmation',
      channel: 'email',
      title: `Application Received: ${event.jobTitle}`,
      message: `Your application for ${event.jobTitle} has been received.`,
      recipient: event.applicantEmail,
      subject: `Application Received: ${event.jobTitle}`,
      status: 'sent',
      read: false,
      sentAt: new Date(),
      createdAt: new Date(),
    };

    logger.log(
      `handleApplicationCreated completed, notificationId=${notification.id}`,
    );
    return { success: true, messageId: notification.id };
  }

  async handleCvParsed(
    event: CvParsedEvent,
  ): Promise<{ success: boolean; messageId?: string }> {
    const logger = new Logger(NotificationService.name);
    logger.log(
      `Processing cv.parsed for applicant ${maskPii(event.applicantEmail)}`,
    );

    await this.emailService.sendEmail({
      to: event.applicantEmail,
      subject: `CV Processed: ${event.jobTitle}`,
      templateId: EmailTemplateId.APPLICATION_RESULT,
      templateData: {
        applicantName: event.applicantName,
        jobTitle: event.jobTitle,
        score: event.score ?? 'N/A',
      },
    });

    const notification: NotificationEntity = {
      id: randomUUID(),
      userId: event.applicationId,
      type: 'application_result',
      channel: 'email',
      title: `CV Processed: ${event.jobTitle}`,
      message: `Your CV for ${event.jobTitle} has been processed. Score: ${event.score ?? 'N/A'}`,
      recipient: event.applicantEmail,
      subject: `CV Processed: ${event.jobTitle}`,
      status: 'sent',
      read: false,
      sentAt: new Date(),
      createdAt: new Date(),
    };

    logger.log(`handleCvParsed completed, notificationId=${notification.id}`);
    return { success: true, messageId: notification.id };
  }

  async handleCvFailed(
    event: CvFailedEvent,
  ): Promise<{ success: boolean; messageId?: string }> {
    const logger = new Logger(NotificationService.name);
    logger.log(
      `Processing cv.failed for applicant ${maskPii(event.applicantEmail)}`,
    );

    await this.emailService.sendEmail({
      to: event.applicantEmail,
      subject: `CV Processing Failed: ${event.jobTitle}`,
      body: `Dear ${event.applicantName},\n\nWe were unable to process your CV for the ${event.jobTitle} position. Reason: ${event.reason}\n\nPlease try uploading again or contact support.`,
    });

    const notification: NotificationEntity = {
      id: randomUUID(),
      userId: event.applicationId,
      type: 'application_result',
      channel: 'email',
      title: `CV Processing Failed: ${event.jobTitle}`,
      message: `CV processing for ${event.jobTitle} failed: ${event.reason}`,
      recipient: event.applicantEmail,
      subject: `CV Processing Failed: ${event.jobTitle}`,
      status: 'sent',
      read: false,
      sentAt: new Date(),
      createdAt: new Date(),
    };

    logger.log(`handleCvFailed completed, notificationId=${notification.id}`);
    return { success: true, messageId: notification.id };
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

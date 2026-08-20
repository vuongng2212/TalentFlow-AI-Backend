import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { maskPii } from '../common/utils/pii-masker';
import { EmailTemplateId } from '../email/email-template';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { WorkspaceMemberInvitedDto } from '../rabbitmq/dtos/workspace-member-invited.dto';
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
import { NotificationGateway } from './notification.gateway';

const RECEIVE_NOTIFICATION_EVENT = 'receiveNotification';

type NotificationResult = {
  success: boolean;
  messageId?: string;
};

type RealtimeNotificationPayload = Omit<
  NotificationResponseDto,
  'recipient' | 'subject'
>;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationGateway: NotificationGateway,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async send(
    dto: SendNotificationDto,
    user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.executeWithMetrics(async () => {
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

      return this.publishRealtime(notification);
    });
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
  ): Promise<NotificationResult> {
    return this.executeWithMetrics(async () => {
      this.logger.log(
        `Processing notification.send event for ${maskPii(event.to)}`,
      );

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

      this.publishRealtime(notification);

      this.logger.log(
        `sendFromEvent completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  async handleApplicationCreated(
    event: ApplicationCreatedEvent,
  ): Promise<NotificationResult> {
    return this.executeWithMetrics(async () => {
      this.logger.log(
        `Processing application.created for applicant ${maskPii(event.applicantEmail)}`,
      );

      await this.emailService.sendEmail({
        to: event.applicantEmail,
        subject: `Application Received: ${event.jobTitle}`,
        templateId: EmailTemplateId.APPLICATION_CONFIRMATION,
        templateData: {
          applicantName: event.applicantName,
          candidateName: event.applicantName,
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

      this.publishRealtime(notification, event.applicantId ?? null);

      this.logger.log(
        `handleApplicationCreated completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  async handleCvParsed(event: CvParsedEvent): Promise<NotificationResult> {
    return this.executeWithMetrics(async () => {
      this.logger.log(
        `Processing cv.parsed for applicant ${maskPii(event.applicantEmail)}`,
      );

      const score = event.score ?? 'N/A';

      await this.emailService.sendEmail({
        to: event.applicantEmail,
        subject: `CV Processed: ${event.jobTitle}`,
        templateId: EmailTemplateId.APPLICATION_RESULT,
        templateData: {
          applicantName: event.applicantName,
          candidateName: event.applicantName,
          jobTitle: event.jobTitle,
          result: `Score: ${score}`,
          score,
        },
      });

      const notification: NotificationEntity = {
        id: randomUUID(),
        userId: event.applicantId ?? event.applicationId,
        type: 'application_result',
        channel: 'email',
        title: `CV Processed: ${event.jobTitle}`,
        message: `Your CV for ${event.jobTitle} has been processed. Score: ${score}`,
        recipient: event.applicantEmail,
        subject: `CV Processed: ${event.jobTitle}`,
        status: 'sent',
        read: false,
        sentAt: new Date(),
        createdAt: new Date(),
      };

      this.publishRealtime(notification, event.applicantId ?? null);

      this.logger.log(
        `handleCvParsed completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  async handleCvFailed(event: CvFailedEvent): Promise<NotificationResult> {
    return this.executeWithMetrics(async () => {
      this.logger.log(
        `Processing cv.failed for applicant ${maskPii(event.applicantEmail)}`,
      );

      await this.emailService.sendEmail({
        to: event.applicantEmail,
        subject: `CV Processing Failed: ${event.jobTitle}`,
        body: `Dear ${event.applicantName},\n\nWe were unable to process your CV for the ${event.jobTitle} position. Reason: ${event.reason}\n\nPlease try uploading again or contact support.`,
      });

      const notification: NotificationEntity = {
        id: randomUUID(),
        userId: event.applicantId ?? event.applicationId,
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

      this.publishRealtime(notification, event.applicantId ?? null);

      this.logger.log(
        `handleCvFailed completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  async handleWorkspaceMemberInvited(
    event: WorkspaceMemberInvitedDto,
  ): Promise<NotificationResult> {
    return this.executeWithMetrics(async () => {
      this.logger.log(
        `Processing workspace.member.invited for ${maskPii(event.email)} (workspace=${event.workspaceName})`,
      );

      await this.emailService.sendEmail({
        to: event.email,
        subject: `You're invited to join ${event.workspaceName} on TalentFlow`,
        templateId: EmailTemplateId.WORKSPACE_INVITATION,
        templateData: {
          workspaceName: event.workspaceName,
          inviteUrl: event.inviteUrl,
          token: event.token,
        },
      });

      const notification: NotificationEntity = {
        id: randomUUID(),
        userId: event.email,
        type: 'workspace_invitation',
        channel: 'email',
        title: `Workspace invitation: ${event.workspaceName}`,
        message: `You have been invited to join ${event.workspaceName}.`,
        recipient: event.email,
        subject: `You're invited to join ${event.workspaceName} on TalentFlow`,
        status: 'sent',
        read: false,
        sentAt: new Date(),
        createdAt: new Date(),
      };

      this.publishRealtime(notification);

      this.logger.log(
        `handleWorkspaceMemberInvited completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  private async executeWithMetrics<T>(operation: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await operation();
      this.metricsService?.recordNotificationSent('email', 'success');
      return result;
    } catch (error) {
      this.metricsService?.recordNotificationSent('email', 'failure');
      throw error;
    } finally {
      this.metricsService?.recordDeliveryDuration(
        'email',
        Date.now() - startedAt,
      );
    }
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
      [SendNotificationType.WORKSPACE_INVITATION]:
        EmailTemplateId.WORKSPACE_INVITATION,
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

  private toRealtimePayload(
    response: NotificationResponseDto,
  ): RealtimeNotificationPayload {
    return {
      id: response.id,
      userId: response.userId,
      type: response.type,
      channel: response.channel,
      title: response.title,
      message: response.message,
      status: response.status,
      read: response.read,
      sentAt: response.sentAt,
      createdAt: response.createdAt,
    };
  }

  private publishRealtime(
    notification: NotificationEntity,
    recipientUserId: string | null = notification.userId,
  ): NotificationResponseDto {
    const response = this.toResponse(notification);
    const realtimePayload = this.toRealtimePayload(response);

    if (!recipientUserId) {
      this.logger.warn(
        `Realtime notification skipped for notificationId=${notification.id}: missing recipient user id`,
      );
      return response;
    }

    try {
      this.notificationGateway.sendToUser(
        recipientUserId,
        RECEIVE_NOTIFICATION_EVENT,
        realtimePayload,
      );
    } catch (error) {
      this.metricsService?.recordNotificationSent('websocket', 'failure');
      this.logger.warn(
        `Realtime notification push failed for userId=${maskPii(recipientUserId)}: ${maskPii(
          error instanceof Error ? error.message : String(error),
        )}`,
      );
    }

    return response;
  }
}

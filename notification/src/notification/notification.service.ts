import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  Notification as StoredNotification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { maskPii } from '../common/utils/pii-masker';
import { EmailTemplateId } from '../email/email-template';
import { EmailService, SendEmailInput } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
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

export type PaginatedNotifications = {
  data: NotificationResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type EmailNotificationDraft = {
  userId: string;
  applicationId?: string;
  type: string;
  title: string;
  message: string;
  email: SendEmailInput;
  realtimeRecipientUserId?: string | null;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationGateway: NotificationGateway,
    private readonly prismaService: PrismaService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async send(
    dto: SendNotificationDto,
    user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.executeWithMetrics(async () => {
      const templateId = dto.templateId ?? this.resolveTemplateId(dto.type);

      return this.deliverEmail({
        userId: user.userId,
        type: dto.type,
        title: dto.subject,
        message: dto.body ?? `Email sent with template ${templateId}`,
        email: {
          to: dto.to,
          subject: dto.subject,
          body: dto.body,
          templateId: dto.body ? undefined : templateId,
          templateData: dto.templateData,
        },
      });
    });
  }

  async getByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedNotifications> {
    const where = { userId, deletedAt: null };
    const [notifications, total] = await Promise.all([
      this.prismaService.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.notification.count({ where }),
    ]);

    return {
      data: notifications.map((notification) =>
        this.toStoredResponse(notification),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string): Promise<NotificationResponseDto | null> {
    const notification = await this.prismaService.notification.findFirst({
      where: { id, deletedAt: null },
    });

    return notification ? this.toStoredResponse(notification) : null;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prismaService.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
  }

  async markAsRead(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prismaService.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });

    return this.toStoredResponse(notification);
  }

  async delete(id: string): Promise<void> {
    await this.prismaService.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

      const notification = await this.deliverEmail({
        userId: event.userId,
        type: event.type as SendNotificationType,
        title: event.subject,
        message: event.body ?? `Email sent with template ${templateId}`,
        email: {
          to: event.to,
          subject: event.subject,
          body: event.body,
          templateId: event.body ? undefined : templateId,
          templateData: event.templateData,
        },
      });

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

      const notification = await this.deliverEmail({
        userId: event.applicantId,
        type: 'application_confirmation',
        title: `Application Received: ${event.jobTitle}`,
        message: `Your application for ${event.jobTitle} has been received.`,
        email: {
          to: event.applicantEmail,
          subject: `Application Received: ${event.jobTitle}`,
          templateId: EmailTemplateId.APPLICATION_CONFIRMATION,
          templateData: {
            applicantName: event.applicantName,
            candidateName: event.applicantName,
            jobTitle: event.jobTitle,
          },
        },
        realtimeRecipientUserId: event.applicantId ?? null,
      });

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

      const score = event.aiScore ?? 'N/A';
      const notification = await this.deliverEmail({
        userId: event.recruiterId ?? event.applicantId ?? event.applicationId,
        applicationId: event.applicationId,
        type: 'application_result',
        title: `CV Processed: ${event.jobTitle}`,
        message: `Your CV for ${event.jobTitle} has been processed. Score: ${score}`,
        email: {
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
        },
        realtimeRecipientUserId: event.recruiterId ?? null,
      });

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

      const notification = await this.deliverEmail({
        userId: event.recruiterId ?? event.applicantId ?? event.applicationId,
        applicationId: event.applicationId,
        type: 'application_result',
        title: `CV Processing Failed: ${event.jobTitle}`,
        message: `CV processing for ${event.jobTitle} failed: ${event.errorMessage ?? 'Unknown error'}`,
        email: {
          to: event.applicantEmail,
          subject: `CV Processing Failed: ${event.jobTitle}`,
          body: `Dear ${event.applicantName},\n\nWe were unable to process your CV for the ${event.jobTitle} position. Reason: ${event.errorMessage ?? 'Unknown error'}\n\nPlease try uploading again or contact support.`,
        },
        realtimeRecipientUserId: event.recruiterId ?? null,
      });

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

      const notification = await this.deliverEmail({
        userId: event.email,
        type: 'workspace_invitation',
        title: `Workspace invitation: ${event.workspaceName}`,
        message: `You have been invited to join ${event.workspaceName}.`,
        email: {
          to: event.email,
          subject: `You're invited to join ${event.workspaceName} on TalentFlow`,
          templateId: EmailTemplateId.WORKSPACE_INVITATION,
          templateData: {
            workspaceName: event.workspaceName,
            inviteUrl: event.inviteUrl,
            token: event.token,
          },
        },
      });

      this.logger.log(
        `handleWorkspaceMemberInvited completed, notificationId=${notification.id}`,
      );
      return { success: true, messageId: notification.id };
    });
  }

  private async deliverEmail(
    draft: EmailNotificationDraft,
  ): Promise<NotificationResponseDto> {
    const pending = await this.prismaService.notification.create({
      data: {
        userId: draft.userId,
        applicationId: draft.applicationId,
        type: this.toStoredType(draft.type),
        channel: NotificationChannel.EMAIL,
        title: draft.title,
        message: draft.message,
        subject: draft.email.subject,
        recipient: draft.email.to,
        templateId: draft.email.templateId,
        status: NotificationStatus.PENDING,
        isRead: false,
      },
    });

    try {
      await this.emailService.sendEmail(draft.email);

      const sent = await this.prismaService.notification.update({
        where: { id: pending.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          errorMessage: null,
        },
      });
      const response = this.toStoredResponse(sent);
      const recipientUserId =
        draft.realtimeRecipientUserId === undefined
          ? draft.userId
          : draft.realtimeRecipientUserId;

      return this.publishRealtime(response, recipientUserId);
    } catch (error) {
      const errorMessage = maskPii(
        error instanceof Error ? error.message : String(error),
      ).slice(0, 2000);

      try {
        await this.prismaService.notification.update({
          where: { id: pending.id },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            errorMessage,
          },
        });
      } catch (persistenceError) {
        this.logger.error(
          `Failed to record notification delivery failure for notificationId=${pending.id}: ${maskPii(
            persistenceError instanceof Error
              ? persistenceError.message
              : String(persistenceError),
          )}`,
        );
      }

      throw error;
    }
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

  private toStoredType(type: string): NotificationType {
    const types: Record<string, NotificationType> = {
      email: NotificationType.EMAIL,
      push: NotificationType.PUSH,
      application_update: NotificationType.APPLICATION_UPDATE,
      application_confirmation: NotificationType.APPLICATION_CONFIRMATION,
      interview_invitation: NotificationType.INTERVIEW_INVITATION,
      new_application_hr: NotificationType.NEW_APPLICATION_HR,
      application_result: NotificationType.APPLICATION_RESULT,
      workspace_invitation: NotificationType.WORKSPACE_INVITATION,
      system: NotificationType.SYSTEM,
    };

    return types[type] ?? NotificationType.SYSTEM;
  }

  private toStoredResponse(
    notification: StoredNotification,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      applicationId: notification.applicationId ?? undefined,
      type: notification.type.toLowerCase(),
      channel: notification.channel.toLowerCase(),
      title: notification.title,
      message: notification.message,
      recipient: notification.recipient ?? undefined,
      subject: notification.subject ?? undefined,
      status: notification.status.toLowerCase(),
      read: notification.isRead,
      isRead: notification.isRead,
      readAt: notification.readAt?.toISOString(),
      sentAt: notification.sentAt?.toISOString(),
      failedAt: notification.failedAt?.toISOString(),
      createdAt: notification.createdAt.toISOString(),
    };
  }

  private toRealtimePayload(
    response: NotificationResponseDto,
  ): RealtimeNotificationPayload {
    return {
      id: response.id,
      userId: response.userId,
      applicationId: response.applicationId,
      type: response.type,
      channel: response.channel,
      title: response.title,
      message: response.message,
      status: response.status,
      read: response.read,
      isRead: response.isRead,
      sentAt: response.sentAt,
      createdAt: response.createdAt,
    };
  }

  private publishRealtime(
    response: NotificationResponseDto,
    recipientUserId: string | null = response.userId,
  ): NotificationResponseDto {
    const realtimePayload = this.toRealtimePayload(response);

    if (!recipientUserId) {
      this.logger.warn(
        `Realtime notification skipped for notificationId=${response.id}: missing recipient user id`,
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

import { Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CvFailedEvent,
  CvParsedEvent,
  ApplicationCreatedEvent,
} from '../rabbitmq/events';
import { WorkspaceMemberInvitedDto } from '../rabbitmq/dtos/workspace-member-invited.dto';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import {
  SendNotificationDto,
  SendNotificationType,
} from './dto/send-notification.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';

describe('NotificationService', () => {
  let service: NotificationService;
  let emailService: { sendEmail: jest.Mock };
  let gateway: { sendToUser: jest.Mock };
  let metricsService: {
    recordNotificationSent: jest.Mock;
    recordDeliveryDuration: jest.Mock;
  };
  let prismaService: {
    notification: {
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let loggerWarnSpy: jest.SpyInstance;

  const recruiterId = 'recruiter-uuid';
  const applicantEmail = 'candidate@example.com';
  const applicantName = 'Nguyễn Văn A';
  const jobTitle = 'Kỹ sư Node.js';
  const applicationId = 'application-uuid';

  beforeEach(() => {
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    gateway = { sendToUser: jest.fn() };
    metricsService = {
      recordNotificationSent: jest.fn(),
      recordDeliveryDuration: jest.fn(),
    };
    const storedBase = {
      id: 'notification-id',
      applicationId: null,
      subject: null,
      recipient: null,
      templateId: null,
      templateData: null,
      metadata: null,
      externalId: null,
      isRead: false,
      readAt: null,
      sentAt: null,
      failedAt: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    let pendingNotification: Record<string, unknown>;
    prismaService = {
      notification: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            pendingNotification = { ...storedBase, ...data };
            return Promise.resolve(pendingNotification);
          }),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({
              ...pendingNotification,
              ...data,
              updatedAt: new Date(),
            }),
          ),
      },
    };

    service = new NotificationService(
      emailService as unknown as EmailService,
      gateway as unknown as NotificationGateway,
      prismaService as unknown as PrismaService,
      metricsService as unknown as MetricsService,
    );

    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  const parsedEvent: CvParsedEvent = {
    applicationId,
    recruiterId,
    applicantEmail,
    applicantName,
    jobTitle,
    aiScore: 85,
    timestamp: new Date().toISOString(),
  };

  const failedEvent: CvFailedEvent = {
    applicationId,
    recruiterId,
    applicantEmail,
    applicantName,
    jobTitle,
    errorMessage: 'Extraction failed',
    timestamp: new Date().toISOString(),
  };

  describe('handleCvParsed & handleCvFailed', () => {
    it('handleCvParsed pushes the realtime socket event to the recruiter room (user:{recruiterId})', async () => {
      await service.handleCvParsed(parsedEvent);

      expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
      const [userId, event, payload] = gateway.sendToUser.mock.calls[0] as [
        string,
        string,
        { type: string; applicationId?: string; title: string },
      ];
      expect(userId).toBe(recruiterId);
      expect(event).toBe('receiveNotification');
      expect(payload.type).toBe('application_result');
      expect(payload.applicationId).toBe(applicationId);
      expect(payload.title).toContain('CV Processed');
    });

    it('handleCvFailed pushes the realtime socket event to the recruiter room (user:{recruiterId})', async () => {
      await service.handleCvFailed(failedEvent);

      expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
      const [userId, event, payload] = gateway.sendToUser.mock.calls[0] as [
        string,
        string,
        { type: string; applicationId?: string; title: string },
      ];
      expect(userId).toBe(recruiterId);
      expect(event).toBe('receiveNotification');
      expect(payload.type).toBe('application_result');
      expect(payload.applicationId).toBe(applicationId);
      expect(payload.title).toContain('Failed');
    });

    it('handleCvParsed skips the realtime push and warns when recruiterId is missing', async () => {
      await service.handleCvParsed({ ...parsedEvent, recruiterId: undefined });

      expect(gateway.sendToUser).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing recipient user id'),
      );
    });

    it('handleCvFailed skips the realtime push and warns when recruiterId is missing', async () => {
      await service.handleCvFailed({ ...failedEvent, recruiterId: undefined });

      expect(gateway.sendToUser).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing recipient user id'),
      );
    });
  });

  describe('send method', () => {
    it('should send email and push realtime notification with body', async () => {
      const dto: SendNotificationDto = {
        to: 'applicant@example.com',
        subject: 'Welcome to TalentFlow',
        type: SendNotificationType.EMAIL,
        body: 'Hello and welcome!',
      };
      const user: AuthenticatedUser = {
        userId: 'admin-123',
        email: 'admin@talentflow.invalid',
        role: 'ADMIN',
      };

      const result = await service.send(dto, user);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@example.com',
          subject: 'Welcome to TalentFlow',
          body: 'Hello and welcome!',
        }),
      );
      expect(gateway.sendToUser).toHaveBeenCalled();
      expect(result.title).toBe('Welcome to TalentFlow');
      expect(result.status).toBe('sent');
    });
  });

  describe('handleApplicationCreated', () => {
    it('should send email and notify applicant on application created', async () => {
      const event: ApplicationCreatedEvent = {
        applicationId: 'app-uuid',
        jobId: 'job-uuid',
        jobTitle: 'Backend Engineer',
        applicantId: 'applicant-uuid',
        applicantEmail: 'candidate@example.com',
        applicantName: 'Nguyen Van A',
        appliedAt: new Date().toISOString(),
      };

      const result = await service.handleApplicationCreated(event);

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidate@example.com',
        }),
      );
    });
  });

  describe('handleWorkspaceMemberInvited', () => {
    it('should send invitation email when member invited to workspace', async () => {
      const event: WorkspaceMemberInvitedDto = {
        email: 'newmember@company.com',
        workspaceName: 'Acme Corp',
        token: 'invite-token-123',
        inviteUrl: 'http://localhost:3000/invite/accept?token=xyz',
      };

      const result = await service.handleWorkspaceMemberInvited(event);

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newmember@company.com',
        }),
      );
    });
  });
});

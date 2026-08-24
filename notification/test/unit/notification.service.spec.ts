import { Logger } from '@nestjs/common';
import { EmailTemplateId } from '../../src/email/email-template';
import { EmailService } from '../../src/email/email.service';
import { NotificationGateway } from '../../src/notification/notification.gateway';
import { NotificationService } from '../../src/notification/notification.service';

describe('NotificationService', () => {
  let emailService: jest.Mocked<Pick<EmailService, 'sendEmail'>>;
  let notificationGateway: jest.Mocked<Pick<NotificationGateway, 'sendToUser'>>;
  let service: NotificationService;

  function expectSuccessfulResult(
    result: Awaited<ReturnType<NotificationService['sendFromEvent']>>,
  ): void {
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }

  function getRealtimePayload(callIndex = 0): Record<string, unknown> {
    return notificationGateway.sendToUser.mock.calls[callIndex][2] as Record<
      string,
      unknown
    >;
  }

  function expectNoEmailMetadata(payload: Record<string, unknown>): void {
    expect(payload).not.toHaveProperty('recipient');
    expect(payload).not.toHaveProperty('subject');
  }

  beforeEach(() => {
    emailService = {
      sendEmail: jest.fn(),
    };
    notificationGateway = {
      sendToUser: jest.fn(),
    };
    service = new NotificationService(
      emailService as unknown as EmailService,
      notificationGateway as unknown as NotificationGateway,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendFromEvent', () => {
    it('sends email from NotificationSendEvent', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.sendFromEvent({
        userId: 'user-1',
        to: 'candidate@example.com',
        subject: 'Test Notification',
        body: 'Your application has been reviewed.',
        type: 'email',
      });

      expectSuccessfulResult(result);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidate@example.com',
          subject: 'Test Notification',
          body: 'Your application has been reviewed.',
        }),
      );
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'receiveNotification',
        expect.objectContaining({
          id: result.messageId,
          userId: 'user-1',
          channel: 'email',
          title: 'Test Notification',
          message: 'Your application has been reviewed.',
          status: 'sent',
          read: false,
        }),
      );
      expectNoEmailMetadata(getRealtimePayload());
    });

    it('resolves template from type when no body provided', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.sendFromEvent({
        userId: 'user-2',
        to: 'candidate@example.com',
        subject: 'Interview',
        type: 'interview_invitation',
        templateData: { candidateName: 'Jane' },
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: EmailTemplateId.INTERVIEW_INVITATION,
          templateData: { candidateName: 'Jane' },
          body: undefined,
        }),
      );
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'receiveNotification',
        expect.objectContaining({
          userId: 'user-2',
          title: 'Interview',
          message: `Email sent with template ${EmailTemplateId.INTERVIEW_INVITATION}`,
        }),
      );
    });

    it('keeps email delivery successful when realtime push fails', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);
      notificationGateway.sendToUser.mockImplementationOnce(() => {
        throw new Error('socket adapter unavailable');
      });

      const result = await service.sendFromEvent({
        userId: 'user-2',
        to: 'candidate@example.com',
        subject: 'Email still succeeds',
        body: 'Realtime is best effort.',
        type: 'email',
      });

      expectSuccessfulResult(result);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(notificationGateway.sendToUser).toHaveBeenCalledTimes(1);
    });

    it('masks recipient user id when realtime push fails', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);
      notificationGateway.sendToUser.mockImplementationOnce(() => {
        throw new Error('socket adapter unavailable');
      });
      const loggerWarnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await service.sendFromEvent({
        userId: 'candidate@example.com',
        to: 'candidate@example.com',
        subject: 'Masked log',
        body: 'Realtime is best effort.',
        type: 'email',
      });

      const warningText = loggerWarnSpy.mock.calls.flat().join(' ');
      expect(warningText).not.toContain('candidate@example.com');
      expect(warningText).toContain('ca*******@example.com');
    });
  });

  describe('handleApplicationCreated', () => {
    it('sends application confirmation email', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.handleApplicationCreated({
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: 'Senior Developer',
        applicantId: 'user-3',
        applicantEmail: 'jane@example.com',
        applicantName: 'Jane Doe',
        appliedAt: '2026-05-07T10:00:00Z',
      });

      expectSuccessfulResult(result);
      const [input] = emailService.sendEmail.mock.calls[0];
      expect(input.to).toBe('jane@example.com');
      expect(input.templateId).toBe(EmailTemplateId.APPLICATION_CONFIRMATION);
      expect(input.templateData).toMatchObject({
        applicantName: 'Jane Doe',
        jobTitle: 'Senior Developer',
      });
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-3',
        'receiveNotification',
        expect.objectContaining({
          id: result.messageId,
          userId: 'user-3',
          title: 'Application Received: Senior Developer',
        }),
      );
    });
  });

  describe('handleCvParsed', () => {
    it('sends CV parsed notification', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.handleCvParsed({
        applicationId: 'app-2',
        applicantId: 'user-4',
        applicantEmail: 'bob@example.com',
        applicantName: 'Bob Smith',
        jobTitle: 'Backend Engineer',
        aiScore: 92,
        timestamp: '2026-05-07T10:00:00Z',
      });

      expectSuccessfulResult(result);
      const [input] = emailService.sendEmail.mock.calls[0];
      expect(input.to).toBe('bob@example.com');
      expect(input.subject).toBe('CV Processed: Backend Engineer');
      expect(input.templateData).toMatchObject({
        applicantName: 'Bob Smith',
        score: 92,
      });
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-4',
        'receiveNotification',
        expect.objectContaining({
          id: result.messageId,
          userId: 'user-4',
          title: 'CV Processed: Backend Engineer',
        }),
      );
    });

    it('handles missing score', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.handleCvParsed({
        applicationId: 'app-3',
        applicantEmail: 'no-score@example.com',
        applicantName: 'Alice',
        jobTitle: 'Designer',
        timestamp: '2026-05-07T10:00:00Z',
      });

      const [input] = emailService.sendEmail.mock.calls[0];
      expect(input.templateData).toMatchObject({ score: 'N/A' });
    });

    it('does not push CV parsed realtime without applicantId', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.handleCvParsed({
        applicationId: 'app-no-recipient',
        applicantEmail: 'no-recipient@example.com',
        applicantName: 'No Recipient',
        jobTitle: 'Designer',
        timestamp: '2026-05-07T10:00:00Z',
      });

      expect(notificationGateway.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('handleCvFailed', () => {
    it('sends CV failure notification', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.handleCvFailed({
        applicationId: 'app-4',
        applicantId: 'user-5',
        applicantEmail: 'fail@example.com',
        applicantName: 'Tom Error',
        jobTitle: 'Data Scientist',
        errorMessage: 'Unsupported file format',
        timestamp: '2026-05-07T10:00:00Z',
      });

      expectSuccessfulResult(result);
      const [input] = emailService.sendEmail.mock.calls[0];
      expect(input.to).toBe('fail@example.com');
      expect(input.subject).toBe('CV Processing Failed: Data Scientist');
      expect(input.body).toContain('Unsupported file format');
      expect(notificationGateway.sendToUser).toHaveBeenCalledWith(
        'user-5',
        'receiveNotification',
        expect.objectContaining({
          id: result.messageId,
          userId: 'user-5',
          title: 'CV Processing Failed: Data Scientist',
        }),
      );
    });

    it('does not push CV failure realtime without applicantId', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.handleCvFailed({
        applicationId: 'app-failed-no-recipient',
        applicantEmail: 'failed-no-recipient@example.com',
        applicantName: 'Failed Recipient',
        jobTitle: 'Data Scientist',
        errorMessage: 'Unsupported file format',
        timestamp: '2026-05-07T10:00:00Z',
      });

      expect(notificationGateway.sendToUser).not.toHaveBeenCalled();
    });
  });
});

import { EmailTemplateId } from '../../src/email/email-template';
import { EmailService } from '../../src/email/email.service';
import { NotificationService } from '../../src/notification/notification.service';

describe('NotificationService', () => {
  let emailService: jest.Mocked<Pick<EmailService, 'sendEmail'>>;
  let service: NotificationService;

  beforeEach(() => {
    emailService = {
      sendEmail: jest.fn(),
    };
    service = new NotificationService(emailService as unknown as EmailService);
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

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidate@example.com',
          subject: 'Test Notification',
          body: 'Your application has been reviewed.',
        }),
      );
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

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@example.com',
          templateId: EmailTemplateId.APPLICATION_CONFIRMATION,
          templateData: expect.objectContaining({
            applicantName: 'Jane Doe',
            jobTitle: 'Senior Developer',
          }),
        }),
      );
    });
  });

  describe('handleCvParsed', () => {
    it('sends CV parsed notification', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.handleCvParsed({
        applicationId: 'app-2',
        applicantEmail: 'bob@example.com',
        applicantName: 'Bob Smith',
        jobTitle: 'Backend Engineer',
        score: 92,
        parsedAt: '2026-05-07T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@example.com',
          subject: 'CV Processed: Backend Engineer',
          templateData: expect.objectContaining({
            applicantName: 'Bob Smith',
            score: 92,
          }),
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
        parsedAt: '2026-05-07T10:00:00Z',
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({ score: 'N/A' }),
        }),
      );
    });
  });

  describe('handleCvFailed', () => {
    it('sends CV failure notification', async () => {
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.handleCvFailed({
        applicationId: 'app-4',
        applicantEmail: 'fail@example.com',
        applicantName: 'Tom Error',
        jobTitle: 'Data Scientist',
        reason: 'Unsupported file format',
        failedAt: '2026-05-07T10:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'fail@example.com',
          subject: 'CV Processing Failed: Data Scientist',
          body: expect.stringContaining('Unsupported file format'),
        }),
      );
    });
  });
});

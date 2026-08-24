import { Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { CvFailedEvent, CvParsedEvent } from '../rabbitmq/events';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

describe('NotificationService - CV result realtime recipient', () => {
  let service: NotificationService;
  let emailService: { sendEmail: jest.Mock };
  let gateway: { sendToUser: jest.Mock };
  let metricsService: { recordNotificationSent: jest.Mock; recordDeliveryDuration?: jest.Mock };
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

    service = new NotificationService(
      emailService as unknown as EmailService,
      gateway as unknown as NotificationGateway,
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

  it('handleCvParsed pushes the realtime socket event to the recruiter room (user:{recruiterId})', async () => {
    await service.handleCvParsed(parsedEvent);

    expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
    const [userId, event, payload] = gateway.sendToUser.mock.calls[0];
    expect(userId).toBe(recruiterId);
    expect(event).toBe('receiveNotification');
    expect(payload.type).toBe('application_result');
    expect(payload.title).toContain('CV Processed');
  });

  it('handleCvFailed pushes the realtime socket event to the recruiter room (user:{recruiterId})', async () => {
    await service.handleCvFailed(failedEvent);

    expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
    const [userId, event, payload] = gateway.sendToUser.mock.calls[0];
    expect(userId).toBe(recruiterId);
    expect(event).toBe('receiveNotification');
    expect(payload.type).toBe('application_result');
    expect(payload.title).toContain('Failed');
  });

  it('handleCvParsed skips the realtime push and warns when recruiterId is missing (previously a silent dead path)', async () => {
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

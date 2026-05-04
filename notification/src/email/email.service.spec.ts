import { MailerService } from '@nestjs-modules/mailer';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmailTemplateId } from './email-template';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let mailerService: jest.Mocked<Pick<MailerService, 'sendMail'>>;
  let service: EmailService;

  beforeEach(() => {
    jest.useFakeTimers();
    mailerService = {
      sendMail: jest.fn(),
    };
    service = new EmailService(mailerService as unknown as MailerService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends a plain text email', async () => {
    mailerService.sendMail.mockResolvedValueOnce({} as never);

    await service.sendEmail({
      to: 'candidate@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith({
      to: 'candidate@example.com',
      subject: 'Test',
      text: 'Hello',
      html: 'Hello',
    });
  });

  it('sends a templated email', async () => {
    mailerService.sendMail.mockResolvedValueOnce({} as never);

    await service.sendEmail({
      to: 'candidate@example.com',
      subject: 'Interview',
      templateId: EmailTemplateId.INTERVIEW_INVITATION,
      templateData: {
        candidateName: 'Jane',
        jobTitle: 'Backend Engineer',
        interviewTime: '2026-05-05 09:00',
        location: 'Google Meet',
      },
    });
    expect(mailerService.sendMail).toHaveBeenCalledWith({
      to: 'candidate@example.com',
      subject: 'Interview',
      text: 'Hello Jane,\n\nYou have been invited to interview for Backend Engineer.\n\nInterview time: 2026-05-05 09:00\nLocation: Google Meet\n\nTalentFlow Team\n',
      html: 'Hello Jane,\n\nYou have been invited to interview for Backend Engineer.\n\nInterview time: 2026-05-05 09:00\nLocation: Google Meet\n\nTalentFlow Team\n',
    });
  });
  it('retries transient failures and then succeeds', async () => {
    mailerService.sendMail
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({} as never);

    const promise = service.sendEmail({
      to: 'candidate@example.com',
      subject: 'Retry',
      body: 'Hello',
    });

    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mailerService.sendMail).toHaveBeenCalledTimes(2);
  });

  it('fails after 3 attempts', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp unavailable'));

    const promise = service.sendEmail({
      to: 'candidate@example.com',
      subject: 'Retry',
      body: 'Hello',
    });
    const expectation = expect(promise).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    await expectation;
    expect(mailerService.sendMail).toHaveBeenCalledTimes(3);
  });
});

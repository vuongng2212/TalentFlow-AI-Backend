import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendNotificationType } from './dto/send-notification.dto';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

describe('NotificationService delivery persistence', () => {
  let service: NotificationService;
  let emailService: { sendEmail: jest.Mock };
  let gateway: { sendToUser: jest.Mock };
  let prisma: {
    notification: {
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const user: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    role: 'RECRUITER',
  };

  const pendingNotification = {
    id: 'notification-from-database',
    userId: user.userId,
    applicationId: null,
    type: NotificationType.EMAIL,
    channel: NotificationChannel.EMAIL,
    title: 'Test notification',
    message: 'Hello',
    subject: 'Test notification',
    recipient: 'candidate@example.com',
    templateId: null,
    templateData: null,
    metadata: null,
    externalId: null,
    status: NotificationStatus.PENDING,
    isRead: false,
    readAt: null,
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    expiresAt: null,
    createdAt: new Date('2026-09-10T08:00:00.000Z'),
    updatedAt: new Date('2026-09-10T08:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    emailService = { sendEmail: jest.fn() };
    gateway = { sendToUser: jest.fn() };
    prisma = {
      notification: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new NotificationService(
      emailService as unknown as EmailService,
      gateway as unknown as NotificationGateway,
      prisma as unknown as PrismaService,
      {
        recordNotificationSent: jest.fn(),
        recordDeliveryDuration: jest.fn(),
      } as unknown as MetricsService,
    );
  });

  it('stores pending before delivery and returns the sent database record', async () => {
    prisma.notification.create.mockResolvedValue(pendingNotification);
    emailService.sendEmail.mockResolvedValue(undefined);
    prisma.notification.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...pendingNotification, ...data }),
    );

    const result = await service.send(
      {
        to: 'candidate@example.com',
        subject: 'Test notification',
        body: 'Hello',
        type: SendNotificationType.EMAIL,
      },
      user,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'notification-from-database',
        status: 'sent',
        userId: user.userId,
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.userId,
        type: NotificationType.EMAIL,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        isRead: false,
      }) as Record<string, unknown>,
    });
    expect(prisma.notification.create.mock.invocationCallOrder[0]).toBeLessThan(
      emailService.sendEmail.mock.invocationCallOrder[0],
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-from-database' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date) as Date,
        failedAt: null,
        errorMessage: null,
      },
    });
  });

  it('does not persist template data that may contain delivery secrets', async () => {
    prisma.notification.create.mockResolvedValue(pendingNotification);
    emailService.sendEmail.mockResolvedValue(undefined);
    prisma.notification.update.mockResolvedValue({
      ...pendingNotification,
      status: NotificationStatus.SENT,
    });

    await service.send(
      {
        to: 'candidate@example.com',
        subject: 'Invitation',
        type: SendNotificationType.EMAIL,
        templateData: {
          token: 'one-time-secret',
          inviteUrl: 'https://example.com/invite?token=one-time-secret',
        },
      },
      user,
    );

    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateData: {
          token: 'one-time-secret',
          inviteUrl: 'https://example.com/invite?token=one-time-secret',
        },
      }),
    );
    const [createInput] = prisma.notification.create.mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(createInput.data).not.toHaveProperty('templateData');
  });

  it('stores a failed delivery and rethrows the delivery error', async () => {
    prisma.notification.create.mockResolvedValue(pendingNotification);
    emailService.sendEmail.mockRejectedValue(new Error('SMTP unavailable'));
    prisma.notification.update.mockResolvedValue({
      ...pendingNotification,
      status: NotificationStatus.FAILED,
    });

    await expect(
      service.send(
        {
          to: 'candidate@example.com',
          subject: 'Test notification',
          body: 'Hello',
          type: SendNotificationType.EMAIL,
        },
        user,
      ),
    ).rejects.toThrow('SMTP unavailable');

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-from-database' },
      data: {
        status: NotificationStatus.FAILED,
        failedAt: expect.any(Date) as Date,
        errorMessage: 'SMTP unavailable',
      },
    });
    expect(gateway.sendToUser).not.toHaveBeenCalled();
  });
});

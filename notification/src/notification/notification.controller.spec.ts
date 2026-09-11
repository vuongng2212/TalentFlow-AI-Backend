/* eslint-disable @typescript-eslint/unbound-method */
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  SendNotificationDto,
  SendNotificationType,
} from './dto/send-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ForbiddenException } from '@nestjs/common';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: jest.Mocked<NotificationService>;

  const mockUser: AuthenticatedUser = {
    userId: 'user-123',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const mockNotificationResponse: NotificationResponseDto = {
    id: 'notif-123',
    userId: 'user-123',
    applicationId: 'app-123',
    type: 'application_result',
    channel: 'email',
    title: 'Test Notification',
    message: 'Test Message',
    status: 'sent',
    read: false,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    service = {
      send: jest.fn().mockResolvedValue(mockNotificationResponse),
      getByUserId: jest.fn().mockResolvedValue({
        data: [mockNotificationResponse],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      getById: jest.fn().mockResolvedValue(mockNotificationResponse),
      getUnreadCount: jest.fn().mockResolvedValue(1),
      markAsRead: jest.fn().mockResolvedValue(mockNotificationResponse),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationService>;

    controller = new NotificationController(service);
  });

  it('should call service.send on sendNotification', async () => {
    const dto: SendNotificationDto = {
      to: 'candidate@example.com',
      subject: 'Interview Update',
      type: SendNotificationType.INTERVIEW_INVITATION,
      body: 'Your interview is scheduled.',
    };

    const result = await controller.sendNotification(dto, mockUser);
    expect(service.send).toHaveBeenCalledWith(dto, mockUser);
    expect(result).toEqual(mockNotificationResponse);
  });

  it('returns the authenticated user notification history', async () => {
    const result = await controller.getByUserId(
      mockUser.userId,
      { page: 1, limit: 20 },
      mockUser,
    );

    expect(service.getByUserId).toHaveBeenCalledWith('user-123', 1, 20);
    expect(result).toEqual({
      success: true,
      data: [mockNotificationResponse],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('rejects another user notification history', async () => {
    await expect(
      controller.getByUserId('another-user', { page: 1, limit: 20 }, mockUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getByUserId).not.toHaveBeenCalled();
  });

  it('marks an owned notification as read', async () => {
    await expect(controller.markAsRead('notif-123', mockUser)).resolves.toEqual(
      { success: true },
    );
    expect(service.markAsRead).toHaveBeenCalledWith('notif-123');
  });
});

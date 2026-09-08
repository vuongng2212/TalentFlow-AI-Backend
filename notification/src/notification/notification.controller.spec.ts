import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { SendNotificationDto, SendNotificationType } from './dto/send-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

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
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    service = {
      send: jest.fn().mockResolvedValue(mockNotificationResponse),
      getNotificationById: jest.fn().mockReturnValue(mockNotificationResponse),
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

  it('should call service.getNotificationById', () => {
    const result = controller.getNotificationById('notif-123', mockUser);
    expect(service.getNotificationById).toHaveBeenCalledWith(
      'notif-123',
      mockUser.userId,
    );
    expect(result).toEqual(mockNotificationResponse);
  });
});

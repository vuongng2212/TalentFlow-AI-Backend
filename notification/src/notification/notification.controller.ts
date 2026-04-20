import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationService } from './notification.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getNotificationById(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): NotificationResponseDto {
    return this.notificationService.getNotificationById(
      id,
      request.user.userId,
    );
  }
}

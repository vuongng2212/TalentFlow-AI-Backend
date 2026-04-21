import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationService } from './notification.service';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getNotificationById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): NotificationResponseDto {
    return this.notificationService.getNotificationById(id, user.userId);
  }
}

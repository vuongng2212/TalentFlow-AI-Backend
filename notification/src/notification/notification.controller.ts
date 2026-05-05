import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationService } from './notification.service';

@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.send(dto, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getNotificationById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): NotificationResponseDto {
    return this.notificationService.getNotificationById(id, user.userId);
  }
}

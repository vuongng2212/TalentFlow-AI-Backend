import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
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

  @Get(':userId/unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertOwnUser(userId, user);
    const count = await this.notificationService.getUnreadCount(userId);
    return { success: true, data: { count } };
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  async getByUserId(
    @Param('userId') userId: string,
    @Query() query: QueryNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertOwnUser(userId, user);
    const result = await this.notificationService.getByUserId(
      userId,
      query.page,
      query.limit,
    );
    return { success: true, ...result };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertOwnNotification(id, user);
    await this.notificationService.markAsRead(id);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertOwnNotification(id, user);
    await this.notificationService.delete(id);
    return { success: true };
  }

  private assertOwnUser(userId: string, user: AuthenticatedUser): void {
    if (user.userId !== userId) {
      throw new ForbiddenException();
    }
  }

  private async assertOwnNotification(
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const notification = await this.notificationService.getById(id);

    if (!notification) {
      throw new NotFoundException();
    }

    if (notification.userId !== user.userId) {
      throw new ForbiddenException();
    }
  }
}

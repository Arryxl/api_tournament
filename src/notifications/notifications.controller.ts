import { Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.notifications.listFor(userId);
  }

  @Get('unread-count')
  unread(@CurrentUser('userId') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Post('read-all')
  readAll(@CurrentUser('userId') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  read(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.notifications.markRead(id, userId);
  }
}

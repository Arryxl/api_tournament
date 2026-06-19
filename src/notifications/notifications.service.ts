import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities';
import { NotificationType } from '../common/enums';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  /** Crea una notificación para un usuario. Pensado para llamarse desde otros servicios. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    link?: string,
    body?: string,
  ) {
    const n = this.notifications.create({
      userId,
      type,
      title,
      link: link ?? null,
      body: body ?? null,
      read: false,
    });
    return this.notifications.save(n);
  }

  listFor(userId: string) {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.notifications.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const n = await this.notifications.findOne({ where: { id } });
    if (!n || n.userId !== userId) {
      throw new NotFoundException('Notificación no encontrada');
    }
    n.read = true;
    await this.notifications.save(n);
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.notifications.update({ userId, read: false }, { read: true });
    return { ok: true };
  }
}

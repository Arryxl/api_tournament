import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoinTransaction, User } from '../entities';
import { TransactionType } from '../common/enums';

@Injectable()
export class CoinsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CoinTransaction)
    private readonly transactions: Repository<CoinTransaction>,
  ) {}

  async balance(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { coins: user.coins };
  }

  history(userId: string) {
    return this.transactions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  leaderboard() {
    return this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.coins', 'u.role'])
      .where('u.isActive = :active', { active: true })
      .orderBy('u.coins', 'DESC')
      .limit(50)
      .getMany();
  }

  async grant(userId: string, amount: number, concept: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.coins += amount;
    await this.users.save(user);
    await this.transactions.save(
      this.transactions.create({
        userId,
        amount,
        concept,
        transactionType: TransactionType.ADMIN_GRANT,
      }),
    );
    return { coins: user.coins };
  }
}

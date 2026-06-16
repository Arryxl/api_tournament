import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CoinTransaction,
  Reward,
  RewardRedemption,
  User,
} from '../entities';
import { RedemptionStatus, TransactionType } from '../common/enums';

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(Reward) private readonly rewards: Repository<Reward>,
    @InjectRepository(RewardRedemption)
    private readonly redemptions: Repository<RewardRedemption>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.rewards.find({
      where: { isActive: true },
      order: { costCoins: 'ASC' },
    });
  }

  create(data: Partial<Reward>) {
    return this.rewards.save(this.rewards.create(data));
  }

  async update(id: string, data: Partial<Reward>) {
    const reward = await this.rewards.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa no encontrada');
    Object.assign(reward, data);
    return this.rewards.save(reward);
  }

  async deactivate(id: string) {
    const reward = await this.rewards.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa no encontrada');
    reward.isActive = false;
    await this.rewards.save(reward);
    return { ok: true };
  }

  async redeem(userId: string, rewardId: string) {
    return this.dataSource.transaction(async (manager) => {
      const reward = await manager.findOne(Reward, { where: { id: rewardId } });
      if (!reward || !reward.isActive) {
        throw new NotFoundException('Recompensa no disponible');
      }
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      if (user.coins < reward.costCoins) {
        throw new BadRequestException('No tienes monedas suficientes');
      }
      if (reward.stock !== null && reward.stock <= 0) {
        throw new BadRequestException('Recompensa agotada');
      }

      user.coins -= reward.costCoins;
      await manager.save(user);

      if (reward.stock !== null) {
        reward.stock -= 1;
        await manager.save(reward);
      }

      await manager.save(
        manager.create(CoinTransaction, {
          userId,
          amount: -reward.costCoins,
          concept: `Canje: ${reward.name}`,
          transactionType: TransactionType.SPENT,
        }),
      );

      const redemption = manager.create(RewardRedemption, {
        userId,
        rewardId,
        status: RedemptionStatus.PENDING,
      });
      return manager.save(redemption);
    });
  }

  listRedemptions() {
    return this.redemptions.find({
      relations: { user: true, reward: true },
      order: { redeemedAt: 'DESC' },
    });
  }

  async updateRedemption(id: string, status: RedemptionStatus, notes?: string) {
    const r = await this.redemptions.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Canje no encontrado');
    r.status = status;
    if (notes !== undefined) r.notes = notes;
    return this.redemptions.save(r);
  }
}

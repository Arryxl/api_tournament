import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  CoinTransaction,
  PlayerStat,
  User,
} from '../entities';
import { TransactionType, UserRole } from '../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(CoinTransaction)
    private readonly transactions: Repository<CoinTransaction>,
    @InjectRepository(PlayerStat)
    private readonly stats: Repository<PlayerStat>,
  ) {}

  private clean(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll() {
    const list = await this.users.find({ order: { createdAt: 'DESC' } });
    return list.map((u) => this.clean(u));
  }

  async createCandidate(data: {
    username: string;
    password: string;
    email?: string;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.users.create({
      username: data.username,
      email: data.email ?? null,
      passwordHash,
      role: UserRole.CANDIDATE,
    });
    await this.users.save(user);
    return this.clean(user);
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if ((data as any).password) {
      user.passwordHash = await bcrypt.hash((data as any).password, 10);
    }
    if (data.username !== undefined) user.username = data.username;
    if (data.email !== undefined) user.email = data.email;
    if (data.role !== undefined) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    await this.users.save(user);
    return this.clean(user);
  }

  async adjustCoins(id: string, amount: number, concept: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.coins += amount;
    await this.users.save(user);
    await this.transactions.save(
      this.transactions.create({
        userId: id,
        amount,
        concept,
        transactionType: TransactionType.ADMIN_GRANT,
      }),
    );
    return this.clean(user);
  }

  async deactivate(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.isActive = false;
    await this.users.save(user);
    return { ok: true };
  }

  async getStats(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const stats = await this.stats.find({
      where: { userId },
      relations: { match: true, team: true },
    });
    const totals = stats.reduce(
      (acc, s) => {
        acc.goals += s.goals;
        acc.assists += s.assists;
        acc.saves += s.saves;
        acc.score += s.score;
        acc.shots += s.shots;
        acc.demos += s.demos;
        acc.mvps += s.mvp ? 1 : 0;
        return acc;
      },
      { goals: 0, assists: 0, saves: 0, score: 0, shots: 0, demos: 0, mvps: 0 },
    );
    return {
      user: this.clean(user),
      matchesPlayed: stats.length,
      totals,
      extraAvg: this.averageExtra(stats),
      perMatch: stats,
    };
  }

  /**
   * Promedia las métricas avanzadas (boost/movimiento/posicionamiento) sobre
   * los partidos que tengan `extra`. Devuelve null si ninguno lo tiene.
   */
  private averageExtra(stats: PlayerStat[]) {
    const withExtra = stats.filter((s) => s.extra != null);
    if (withExtra.length === 0) return null;
    const n = withExtra.length;
    const acc: any = {};
    for (const s of withExtra) {
      const e = s.extra as Record<string, Record<string, number>>;
      for (const group of Object.keys(e)) {
        acc[group] ??= {};
        for (const key of Object.keys(e[group])) {
          acc[group][key] = (acc[group][key] ?? 0) + (e[group][key] ?? 0);
        }
      }
    }
    for (const group of Object.keys(acc)) {
      for (const key of Object.keys(acc[group])) {
        acc[group][key] = Math.round((acc[group][key] / n) * 100) / 100;
      }
    }
    return acc;
  }
}

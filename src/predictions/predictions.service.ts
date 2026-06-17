import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  Match,
  Prediction,
  PredictionWindow,
  User,
} from '../entities';

@Injectable()
export class PredictionsService {
  constructor(
    @InjectRepository(Prediction)
    private readonly predictions: Repository<Prediction>,
    @InjectRepository(PredictionWindow)
    private readonly windows: Repository<PredictionWindow>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  async forMatch(matchId: string) {
    return this.predictions.find({
      where: { matchId },
      relations: { user: true, predictedWinner: true },
    });
  }

  private async assertWindowOpen(matchId: string) {
    const now = new Date();
    const win = await this.windows.findOne({
      where: {
        matchId,
        isActive: true,
        openFrom: LessThanOrEqual(now),
        openUntil: MoreThanOrEqual(now),
      },
    });
    if (!win) {
      throw new BadRequestException(
        'Las predicciones para este partido están cerradas',
      );
    }
  }

  async create(
    userId: string,
    data: {
      matchId: string;
      predictedWinnerId: string;
      predictedHomeScore?: number;
      predictedAwayScore?: number;
    },
  ) {
    await this.assertWindowOpen(data.matchId);
    const existing = await this.predictions.findOne({
      where: { userId, matchId: data.matchId },
    });
    if (existing) {
      throw new BadRequestException('Ya hiciste una predicción para este partido');
    }
    const pred = this.predictions.create({
      userId,
      matchId: data.matchId,
      predictedWinnerId: data.predictedWinnerId,
      predictedHomeScore: data.predictedHomeScore ?? null,
      predictedAwayScore: data.predictedAwayScore ?? null,
    });
    await this.predictions.save(pred);
    return pred;
  }

  myPredictions(userId: string) {
    return this.predictions.find({
      where: { userId },
      relations: { match: true, predictedWinner: true },
      order: { createdAt: 'DESC' },
    });
  }

  async leaderboard() {
    const raw = await this.predictions
      .createQueryBuilder('p')
      .leftJoin('p.user', 'user')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('SUM(p.coins_earned)', 'coins')
      .addSelect(
        'SUM(CASE WHEN p.is_correct THEN 1 ELSE 0 END)',
        'correct',
      )
      .addSelect('COUNT(p.id)', 'total')
      .groupBy('user.id')
      .addGroupBy('user.username')
      .orderBy('coins', 'DESC')
      .limit(50)
      .getRawMany();
    return raw;
  }

  async createWindow(
    adminId: string,
    data: { matchId: string; openFrom: string; openUntil: string },
  ) {
    const match = await this.matches.findOne({ where: { id: data.matchId } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    const win = this.windows.create({
      matchId: data.matchId,
      openFrom: new Date(data.openFrom),
      openUntil: new Date(data.openUntil),
      isActive: true,
      createdBy: adminId,
    });
    await this.windows.save(win);
    match.predictionsOpen = true;
    await this.matches.save(match);
    return win;
  }

  /** [ADMIN] Cierra todas las ventanas de un partido y marca predicciones cerradas. */
  async closeForMatch(matchId: string) {
    await this.windows.update({ matchId }, { isActive: false });
    const match = await this.matches.findOne({ where: { id: matchId } });
    if (match) {
      match.predictionsOpen = false;
      await this.matches.save(match);
    }
    return { ok: true };
  }

  async toggleWindow(id: string, isActive: boolean) {
    const win = await this.windows.findOne({ where: { id } });
    if (!win) throw new NotFoundException('Ventana no encontrada');
    win.isActive = isActive;
    await this.windows.save(win);
    const match = await this.matches.findOne({ where: { id: win.matchId } });
    if (match) {
      match.predictionsOpen = isActive;
      await this.matches.save(match);
    }
    return win;
  }
}

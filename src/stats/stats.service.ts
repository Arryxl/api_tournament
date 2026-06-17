import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerStat } from '../entities';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PlayerStat)
    private readonly stats: Repository<PlayerStat>,
  ) {}

  private topBy(column: 'goals' | 'assists' | 'saves' | 'score', limit = 10) {
    return this.stats
      .createQueryBuilder('s')
      .leftJoin('s.user', 'user')
      .leftJoin('s.team', 'team')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('team.id', 'teamId')
      .addSelect('team.name', 'teamName')
      .addSelect(`SUM(s.${column})`, 'total')
      .addSelect('COUNT(s.id)', 'matchesPlayed')
      .groupBy('user.id')
      .addGroupBy('user.username')
      .addGroupBy('team.id')
      .addGroupBy('team.name')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  topScorers() {
    return this.topBy('goals');
  }
  topAssists() {
    return this.topBy('assists');
  }
  topSaves() {
    return this.topBy('saves');
  }
  topScore() {
    return this.topBy('score');
  }

  player(userId: string) {
    return this.stats.find({
      where: { userId },
      relations: { match: true, team: true },
    });
  }

  team(teamId: string) {
    return this.stats.find({
      where: { teamId },
      relations: { match: true, user: true },
    });
  }

  matchStats(matchId: string) {
    return this.stats.find({
      where: { matchId },
      relations: { user: true, team: true },
    });
  }

  /** [ADMIN] Reemplaza las stats individuales de un partido (corrección manual). */
  async setMatchStats(matchId: string, rows: MatchStatInput[]) {
    await this.stats.delete({ matchId });
    for (const s of rows) {
      await this.stats.save(
        this.stats.create({
          matchId,
          userId: s.userId,
          teamId: s.teamId,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          saves: s.saves ?? 0,
          score: s.score ?? 0,
          shots: s.shots ?? 0,
          demos: s.demos ?? 0,
          mvp: s.mvp ?? false,
        }),
      );
    }
    return this.matchStats(matchId);
  }
}

interface MatchStatInput {
  userId: string;
  teamId: string;
  goals?: number;
  assists?: number;
  saves?: number;
  score?: number;
  shots?: number;
  demos?: number;
  mvp?: boolean;
}

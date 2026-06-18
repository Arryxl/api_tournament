import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerStat } from '../entities';
import { MatchStatus } from '../common/enums';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PlayerStat)
    private readonly stats: Repository<PlayerStat>,
  ) {}

  private topBy(
    column: 'goals' | 'assists' | 'saves' | 'score' | 'shots' | 'demos',
    limit = 10,
  ) {
    return this.stats
      .createQueryBuilder('s')
      .innerJoin('s.match', 'm')
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
  topShots() {
    return this.topBy('shots');
  }
  topDemos() {
    return this.topBy('demos');
  }

  /** Ranking de MVPs: cuenta los partidos donde el jugador fue MVP. */
  topMvp(limit = 10) {
    return this.stats
      .createQueryBuilder('s')
      .innerJoin('s.match', 'm')
      .leftJoin('s.user', 'user')
      .leftJoin('s.team', 'team')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('team.id', 'teamId')
      .addSelect('team.name', 'teamName')
      .addSelect('SUM(CASE WHEN s.mvp THEN 1 ELSE 0 END)', 'total')
      .addSelect('COUNT(s.id)', 'matchesPlayed')
      .groupBy('user.id')
      .addGroupBy('user.username')
      .addGroupBy('team.id')
      .addGroupBy('team.name')
      .having('SUM(CASE WHEN s.mvp THEN 1 ELSE 0 END) > 0')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  /** Resumen agregado de toda la temporada para la página pública de resultados. */
  async summary() {
    const agg = await this.stats
      .createQueryBuilder('s')
      // Solo partidos finalizados que existen (ignora stats huérfanas).
      .innerJoin('s.match', 'm', 'm.status = :st', { st: MatchStatus.FINISHED })
      .select('COALESCE(SUM(s.goals),0)', 'goals')
      .addSelect('COALESCE(SUM(s.assists),0)', 'assists')
      .addSelect('COALESCE(SUM(s.saves),0)', 'saves')
      .addSelect('COALESCE(SUM(s.shots),0)', 'shots')
      .addSelect('COALESCE(SUM(s.demos),0)', 'demos')
      .addSelect('COALESCE(SUM(CASE WHEN s.mvp THEN 1 ELSE 0 END),0)', 'mvps')
      .addSelect('COUNT(DISTINCT s.user_id)', 'players')
      .addSelect('COUNT(DISTINCT s.match_id)', 'matches')
      .getRawOne();

    const num = (v: any) => Number(v) || 0;
    const matches = num(agg?.matches);
    const goals = num(agg?.goals);
    return {
      matchesPlayed: matches,
      players: num(agg?.players),
      goals,
      assists: num(agg?.assists),
      saves: num(agg?.saves),
      shots: num(agg?.shots),
      demos: num(agg?.demos),
      mvps: num(agg?.mvps),
      avgGoalsPerMatch: matches ? Math.round((goals / matches) * 10) / 10 : 0,
    };
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
    // Preservar las métricas avanzadas (extra) del replay: este editor manual
    // no las toca, pero borra y recrea, así que se reinyectan por usuario.
    const previous = await this.stats.find({ where: { matchId } });
    const extraByUser = new Map(
      previous.filter((p) => p.extra != null).map((p) => [p.userId, p.extra]),
    );
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
          extra: s.extra ?? extraByUser.get(s.userId) ?? null,
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
  extra?: unknown;
}

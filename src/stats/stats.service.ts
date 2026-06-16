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
}

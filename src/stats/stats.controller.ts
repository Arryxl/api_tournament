import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StatsService } from './stats.service';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Public()
  @Get('top-scorers')
  topScorers() {
    return this.stats.topScorers();
  }

  @Public()
  @Get('top-assists')
  topAssists() {
    return this.stats.topAssists();
  }

  @Public()
  @Get('top-saves')
  topSaves() {
    return this.stats.topSaves();
  }

  @Public()
  @Get('top-score')
  topScore() {
    return this.stats.topScore();
  }

  @Public()
  @Get('top-shots')
  topShots() {
    return this.stats.topShots();
  }

  @Public()
  @Get('top-demos')
  topDemos() {
    return this.stats.topDemos();
  }

  @Public()
  @Get('top-mvp')
  topMvp() {
    return this.stats.topMvp();
  }

  @Public()
  @Get('summary')
  summary() {
    return this.stats.summary();
  }

  @Public()
  @Get('player/:userId')
  player(@Param('userId') userId: string) {
    return this.stats.player(userId);
  }

  @Public()
  @Get('team/:teamId')
  team(@Param('teamId') teamId: string) {
    return this.stats.team(teamId);
  }

  @Public()
  @Get('match/:matchId')
  matchStats(@Param('matchId') matchId: string) {
    return this.stats.matchStats(matchId);
  }

  @Roles(UserRole.ADMIN)
  @Post('match/:matchId')
  setMatchStats(@Param('matchId') matchId: string, @Body() body: any) {
    return this.stats.setMatchStats(matchId, body?.stats ?? body ?? []);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CoinTransaction,
  Group,
  GroupStanding,
  Match,
  PlayerStat,
  Prediction,
  TournamentSettings,
  User,
} from '../entities';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      GroupStanding,
      PlayerStat,
      Prediction,
      User,
      CoinTransaction,
      Group,
      TournamentSettings,
    ]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}

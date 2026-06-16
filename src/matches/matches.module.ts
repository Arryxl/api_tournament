import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CoinTransaction,
  GroupStanding,
  Match,
  PlayerStat,
  Prediction,
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
    ]),
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}

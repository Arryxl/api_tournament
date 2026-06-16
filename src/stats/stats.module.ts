import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerStat } from '../entities';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlayerStat])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CoinTransaction,
  Reward,
  RewardRedemption,
  User,
} from '../entities';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward, RewardRedemption, User, CoinTransaction]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}

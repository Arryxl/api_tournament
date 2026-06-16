import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoinTransaction, User } from '../entities';
import { CoinsService } from './coins.service';
import { CoinsController } from './coins.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, CoinTransaction])],
  controllers: [CoinsController],
  providers: [CoinsService],
})
export class CoinsModule {}

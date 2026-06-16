import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match, Prediction, PredictionWindow, User } from '../entities';
import { PredictionsService } from './predictions.service';
import { PredictionsController } from './predictions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prediction, PredictionWindow, Match, User]),
  ],
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}

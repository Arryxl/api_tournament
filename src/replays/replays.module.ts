import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match, Replay, TeamMember } from '../entities';
import { ReplaysService } from './replays.service';
import { ReplaysController } from './replays.controller';
import { BallchasingClient } from './ballchasing.client';
import { LinkingModule } from '../linking/linking.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Replay, Match, TeamMember]),
    LinkingModule,
    MatchesModule,
  ],
  controllers: [ReplaysController],
  providers: [ReplaysService, BallchasingClient],
  exports: [ReplaysService],
})
export class ReplaysModule {}

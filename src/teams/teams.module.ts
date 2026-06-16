import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PlayerStat,
  RegistrationForm,
  Team,
  TeamMember,
  User,
} from '../entities';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      RegistrationForm,
      User,
      PlayerStat,
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}

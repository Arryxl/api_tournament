import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PlayerStat,
  PresetTeam,
  RegistrationForm,
  Team,
  TeamDraft,
  TeamMember,
  TournamentSettings,
  User,
} from '../entities';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      RegistrationForm,
      TeamDraft,
      PresetTeam,
      User,
      PlayerStat,
      TournamentSettings,
    ]),
    NotificationsModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}

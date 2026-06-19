import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  JoinRequest,
  Notification,
  PlayerProfile,
  RecruitmentPost,
  RegistrationForm,
  Team,
  TeamDraft,
  TeamDraftInvite,
  TeamLeaveRequest,
  TeamMember,
  TournamentSettings,
  User,
} from '../entities';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecruitmentPost,
      JoinRequest,
      TeamLeaveRequest,
      PlayerProfile,
      TeamDraft,
      TeamDraftInvite,
      Notification,
      RegistrationForm,
      Team,
      TeamMember,
      TournamentSettings,
      User,
    ]),
    TeamsModule,
    NotificationsModule,
  ],
  controllers: [RecruitmentController],
  providers: [RecruitmentService],
})
export class RecruitmentModule {}

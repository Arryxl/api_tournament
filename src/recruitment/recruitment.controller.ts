import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { RecruitmentService } from './recruitment.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import {
  JoinDirection,
  PlayerPosition,
  PlayerRank,
  RecruitmentStatus,
  RecruitmentType,
  UserRole,
} from '../common/enums';

class ProfileDto {
  @IsOptional() @IsString() epicUsername?: string;
  @IsOptional() @IsString() steamUsername?: string;
  @IsOptional() @IsEnum(PlayerRank) rank?: PlayerRank;
  @IsOptional() @IsString() screenshotUrl?: string;
  @IsOptional() @IsEnum(PlayerPosition) position?: PlayerPosition;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() availability?: string;
}

class CreatePostDto {
  @IsEnum(RecruitmentType) type: RecruitmentType;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() availability?: string;
  // TEAM_LFP
  @IsOptional() @IsString() teamName?: string;
  @IsOptional() @IsEnum(PlayerRank) lookingForRank?: PlayerRank;
  @IsOptional() @IsEnum(PlayerPosition) lookingForPosition?: PlayerPosition;
  @IsOptional() @IsInt() @Min(1) slotsNeeded?: number;
}

class UpdatePostDto {
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() availability?: string;
  @IsOptional() @IsEnum(PlayerRank) lookingForRank?: PlayerRank;
  @IsOptional() @IsEnum(PlayerPosition) lookingForPosition?: PlayerPosition;
  @IsOptional() @IsInt() @Min(1) slotsNeeded?: number;
  @IsOptional() @IsEnum(RecruitmentStatus) status?: RecruitmentStatus;
}

class CreateRequestDto {
  @IsUUID() teamId: string;
  @IsEnum(JoinDirection) direction: JoinDirection;
  @IsOptional() @IsUUID() applicantId?: string;
  @IsOptional() @IsUUID() sourcePostId?: string;
  @IsOptional() @IsString() message?: string;
}

class CreateDraftDto {
  @IsString() teamName: string;
  @IsOptional() @IsString() shieldUrl?: string;
  @IsOptional() @IsString() contactMethod?: string;
  @IsString() contactValue: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('all', { each: true }) inviteUserIds: string[];
}

@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  // -------- Perfil de jugador --------

  @Get('profile')
  getProfile(@CurrentUser('userId') userId: string) {
    return this.recruitment.getProfile(userId);
  }

  @Put('profile')
  upsertProfile(@CurrentUser('userId') userId: string, @Body() dto: ProfileDto) {
    return this.recruitment.upsertProfile(userId, dto);
  }

  // -------- Vitrina --------

  @Public()
  @Get()
  list(
    @Query('type') type?: RecruitmentType,
    @Query('rank') rank?: string,
    @Query('position') position?: string,
    @Query('status') status?: RecruitmentStatus,
  ) {
    return this.recruitment.list({ type, rank, position, status });
  }

  @Get('mine')
  mine(@CurrentUser('userId') userId: string) {
    return this.recruitment.mine(userId);
  }

  @Post()
  createPost(@CurrentUser('userId') userId: string, @Body() dto: CreatePostDto) {
    return this.recruitment.createPost(userId, dto);
  }

  // -------- Solicitudes de unión --------

  @Post('requests')
  createRequest(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateRequestDto,
  ) {
    return this.recruitment.createRequest(userId, dto);
  }

  @Get('requests/incoming')
  incoming(@CurrentUser('userId') userId: string) {
    return this.recruitment.incoming(userId);
  }

  @Get('requests/outgoing')
  outgoing(@CurrentUser('userId') userId: string) {
    return this.recruitment.outgoing(userId);
  }

  @Post('requests/:id/accept')
  acceptRequest(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.acceptRequest(id, userId);
  }

  @Post('requests/:id/reject')
  rejectRequest(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.rejectRequest(id, userId);
  }

  @Post('requests/:id/cancel')
  cancelRequest(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.cancelRequest(id, userId);
  }

  // -------- Salida de equipo --------

  @Post('leave')
  requestLeave(
    @CurrentUser('userId') userId: string,
    @Body() body: { reason?: string },
  ) {
    return this.recruitment.requestLeave(userId, body?.reason);
  }

  @Get('leave/incoming')
  leaveIncoming(@CurrentUser('userId') userId: string) {
    return this.recruitment.leaveIncoming(userId);
  }

  @Post('leave/:id/accept')
  acceptLeave(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.acceptLeave(id, userId);
  }

  @Post('leave/:id/reject')
  rejectLeave(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.rejectLeave(id, userId);
  }

  // -------- Creación de equipo (drafts) --------

  @Post('drafts')
  createDraft(@CurrentUser('userId') userId: string, @Body() dto: CreateDraftDto) {
    return this.recruitment.createDraft(userId, dto);
  }

  @Get('drafts/mine')
  draftsMine(@CurrentUser('userId') userId: string) {
    return this.recruitment.draftsMine(userId);
  }

  @Post('drafts/invites/:id/accept')
  acceptDraftInvite(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.acceptDraftInvite(id, userId);
  }

  @Post('drafts/invites/:id/reject')
  rejectDraftInvite(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.rejectDraftInvite(id, userId);
  }

  @Post('drafts/:id/cancel')
  cancelDraft(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.recruitment.cancelDraft(id, userId);
  }

  // -------- Admin --------

  @Roles(UserRole.ADMIN)
  @Get('admin/posts')
  adminPosts() {
    return this.recruitment.listAllPosts();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/requests')
  adminRequests() {
    return this.recruitment.listAllRequests();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/drafts')
  adminDrafts() {
    return this.recruitment.listAllDrafts();
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/drafts/:id/cancel')
  adminCancelDraft(@Param('id') id: string) {
    return this.recruitment.adminCancelDraft(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/drafts/:id/submit')
  adminSubmitDraft(@Param('id') id: string) {
    return this.recruitment.adminSubmitDraft(id);
  }

  @Roles(UserRole.ADMIN)
  @Delete('admin/drafts/:id')
  adminDeleteDraft(@Param('id') id: string) {
    return this.recruitment.adminDeleteDraft(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/moderate')
  moderate(@Param('id') id: string) {
    return this.recruitment.moderatePost(id);
  }

  // -------- Edición/borrado del propio anuncio (dueño o admin) --------

  @Patch(':id')
  updatePost(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: UserRole },
    @Body() dto: UpdatePostDto,
  ) {
    return this.recruitment.updatePost(
      id,
      user.userId,
      user.role === UserRole.ADMIN,
      dto as any,
    );
  }

  @Delete(':id')
  deletePost(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: UserRole },
  ) {
    return this.recruitment.deletePost(
      id,
      user.userId,
      user.role === UserRole.ADMIN,
    );
  }
}

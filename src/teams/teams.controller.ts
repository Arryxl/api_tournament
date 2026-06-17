import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { TeamsService } from './teams.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { RegistrationStatus, UserRole } from '../common/enums';

class RejectDto {
  @IsString()
  reason: string;
}

class ApproveDto {
  @IsOptional()
  @IsArray()
  credentials?: { username: string; password: string }[];
}

class AddMemberDto {
  @IsOptional() @IsString() epicUsername?: string;
  @IsOptional() @IsString() steamUsername?: string;
  @IsOptional() @IsString() rank?: string;
  @IsOptional() @IsString() screenshotUrl?: string;
  @IsOptional() @IsBoolean() isCaptain?: boolean;
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() password?: string;
}

class UpdateMemberDto {
  @IsOptional() @IsString() epicUsername?: string;
  @IsOptional() @IsString() steamUsername?: string;
  @IsOptional() @IsString() rank?: string;
  @IsOptional() @IsString() screenshotUrl?: string;
  @IsOptional() @IsBoolean() isCaptain?: boolean;
}

class MemberAccessDto {
  @IsBoolean()
  active: boolean;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Public()
  @Get()
  findAll() {
    return this.teams.findAll();
  }

  @Public()
  @Get('count')
  count() {
    return this.teams.count();
  }

  @Public()
  @Post('register')
  register(@Body() body: any) {
    return this.teams.register(body);
  }

  @Roles(UserRole.ADMIN)
  @Get('registrations')
  listRegistrations(@Query('status') status?: RegistrationStatus) {
    return this.teams.listRegistrations(status);
  }

  @Roles(UserRole.ADMIN)
  @Get('registrations/:id')
  getRegistration(@Param('id') id: string) {
    return this.teams.getRegistration(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('registrations/:id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: ApproveDto,
  ) {
    return this.teams.approveRegistration(id, userId, dto.credentials);
  }

  @Roles(UserRole.ADMIN)
  @Post('registrations/:id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: RejectDto,
  ) {
    return this.teams.rejectRegistration(id, userId, dto.reason);
  }

  @Roles(UserRole.ADMIN, UserRole.CANDIDATE)
  @Get('mine')
  mine(@CurrentUser('userId') userId: string) {
    return this.teams.myTeam(userId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teams.findOne(id);
  }

  @Public()
  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.teams.getStats(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.teams.update(id, body);
  }

  // -------- Roster (admin) --------

  @Roles(UserRole.ADMIN)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.teams.addMember(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('members/:memberId')
  updateMember(@Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
    return this.teams.updateMember(memberId, dto as any);
  }

  @Roles(UserRole.ADMIN)
  @Patch('members/:memberId/access')
  setMemberAccess(@Param('memberId') memberId: string, @Body() dto: MemberAccessDto) {
    return this.teams.setMemberAccess(memberId, dto.active);
  }

  @Roles(UserRole.ADMIN)
  @Delete('members/:memberId')
  removeMember(@Param('memberId') memberId: string) {
    return this.teams.removeMember(memberId);
  }
}

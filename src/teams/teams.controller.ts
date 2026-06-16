import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
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

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Public()
  @Get()
  findAll() {
    return this.teams.findAll();
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
}

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Public()
  @Get()
  findAll() {
    return this.matches.findAll();
  }

  @Public()
  @Get('schedule')
  schedule() {
    return this.matches.schedule();
  }

  @Public()
  @Get('bracket')
  bracket() {
    return this.matches.bracket();
  }

  @Public()
  @Get('expected')
  expected() {
    return this.matches.expected();
  }

  @Roles(UserRole.ADMIN)
  @Post('generate')
  generate(@Body() body: any) {
    return this.matches.generateBracket(!!body?.preserveDates);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matches.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() body: any) {
    return this.matches.create(body);
  }

  @Roles(UserRole.ADMIN)
  @Patch('schedule-bulk')
  scheduleBulk(@Body() body: any) {
    return this.matches.scheduleBulk(body.items);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/schedule')
  updateSchedule(@Param('id') id: string, @Body() body: any) {
    return this.matches.updateSchedule(id, body.scheduledAt ?? null);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/teams')
  assignTeams(@Param('id') id: string, @Body() body: any) {
    return this.matches.assignTeams(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/result')
  result(@Param('id') id: string, @Body() body: any) {
    return this.matches.loadResult(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/live')
  live(@Param('id') id: string, @Body() body: any) {
    return this.matches.markLive(id, body?.live ?? true);
  }
}

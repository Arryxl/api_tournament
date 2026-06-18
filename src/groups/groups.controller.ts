import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsArray } from 'class-validator';
import { GroupsService } from './groups.service';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';

class CommitDrawDto {
  @IsArray()
  assignments: { teamId: string; groupName: string }[];
}

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Public()
  @Get()
  findAll() {
    return this.groups.findAll();
  }

  @Public()
  @Get('standings')
  standings() {
    return this.groups.getStandings();
  }

  @Roles(UserRole.ADMIN)
  @Post('draw')
  draw() {
    return this.groups.draw();
  }

  @Roles(UserRole.ADMIN)
  @Post('draw/commit')
  commit(@Body() dto: CommitDrawDto) {
    return this.groups.commit(dto.assignments);
  }

  /**
   * Sincroniza la fase de grupos con el sorteo actual: reconstruye las tablas
   * y rellena los cruces de los partidos de grupo en un solo paso.
   */
  @Roles(UserRole.ADMIN)
  @Post('sync')
  syncGroups() {
    return this.groups.syncGroups();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groups.findOne(id);
  }
}

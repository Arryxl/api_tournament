import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Group,
  GroupStanding,
  Match,
  Team,
} from '../entities';
import { TeamStatus } from '../common/enums';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupStanding)
    private readonly standings: Repository<GroupStanding>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  async ensureGroups() {
    const count = await this.groups.count();
    if (count === 0) {
      for (const name of ['A', 'B', 'C', 'D']) {
        await this.groups.save(this.groups.create({ name }));
      }
    }
    return this.groups.find({ order: { name: 'ASC' } });
  }

  async findAll() {
    const groups = await this.ensureGroups();
    const result = [];
    for (const g of groups) {
      const teams = await this.teams.find({ where: { groupId: g.id } });
      result.push({ ...g, teams });
    }
    return result;
  }

  async getStandings() {
    const standings = await this.standings.find({
      relations: { team: true, group: true },
    });
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
    return standings;
  }

  async findOne(id: string) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const teams = await this.teams.find({ where: { groupId: id } });
    const standings = await this.standings.find({
      where: { groupId: id },
      relations: { team: true },
    });
    const matches = await this.matches.find({
      where: { groupId: id },
      relations: { teamHome: true, teamAway: true },
    });
    return { group, teams, standings, matches };
  }

  /** Sorteo: reparte los equipos aprobados en los 4 grupos (4 por grupo). */
  async draw() {
    const groups = await this.ensureGroups();
    const approved = await this.teams.find({
      where: { status: TeamStatus.APPROVED },
    });
    if (approved.length === 0) {
      throw new BadRequestException('No hay equipos aprobados para sortear');
    }
    // barajar
    const shuffled = [...approved].sort(() => Math.random() - 0.5);

    // limpiar standings previos
    await this.standings.createQueryBuilder().delete().execute();

    for (let i = 0; i < shuffled.length; i++) {
      const team = shuffled[i];
      const group = groups[i % groups.length];
      team.groupId = group.id;
      await this.teams.save(team);
      await this.standings.save(
        this.standings.create({ groupId: group.id, teamId: team.id }),
      );
    }
    return this.findAll();
  }

  /**
   * Persiste el resultado de un sorteo ya revelado en vivo. Recibe la
   * asignación equipo → grupo decidida en el control deck y la guarda
   * (reescribe groupId de cada equipo y recrea sus standings en cero).
   */
  async commit(assignments: { teamId: string; groupName: string }[]) {
    if (!assignments?.length) {
      throw new BadRequestException('No hay asignaciones para guardar');
    }
    const groups = await this.ensureGroups();
    const byName = new Map(groups.map((g) => [g.name, g]));

    await this.standings.createQueryBuilder().delete().execute();
    for (const a of assignments) {
      const group = byName.get(a.groupName);
      if (!group) continue;
      await this.teams.update({ id: a.teamId }, { groupId: group.id });
      await this.standings.save(
        this.standings.create({ groupId: group.id, teamId: a.teamId }),
      );
    }
    return this.findAll();
  }
}

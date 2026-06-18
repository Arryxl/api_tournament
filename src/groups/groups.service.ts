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
  TournamentSettings,
} from '../entities';
import { MatchStatus, TeamStatus } from '../common/enums';
import { groupLettersFor } from '../common/tournament';

// Calendario round-robin de un grupo de 4 (índices de equipo por jornada).
// Coincide con G{letra}-1..6 generados por la estructura de partidos.
const ROUND_ROBIN: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(GroupStanding)
    private readonly standings: Repository<GroupStanding>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(TournamentSettings)
    private readonly settings: Repository<TournamentSettings>,
  ) {}

  /** Nº de equipos configurado (default 16). */
  private async teamCount(): Promise<number> {
    const s = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    return s?.teamCapacity ?? 16;
  }

  /**
   * Garantiza que existan exactamente los grupos que corresponden al nº de
   * equipos configurado (16 ⇒ A–D, 32 ⇒ A–H). Crea los que falten y devuelve
   * solo los relevantes (los sobrantes de una config anterior se ignoran).
   */
  async ensureGroups(teamCount?: number) {
    const count = teamCount ?? (await this.teamCount());
    const letters = groupLettersFor(count);
    const existing = await this.groups.find();
    const byName = new Map(existing.map((g) => [g.name, g]));
    for (const name of letters) {
      if (!byName.has(name)) {
        await this.groups.save(this.groups.create({ name }));
      }
    }
    const all = await this.groups.find({ order: { name: 'ASC' } });
    return all.filter((g) => letters.includes(g.name));
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

  /**
   * Rellena los partidos de la fase de grupos (G{letra}-1..6) con los cruces
   * round-robin de cada grupo, a partir de los equipos ya sorteados. No toca
   * partidos finalizados. Se ejecuta automáticamente tras un sorteo y también
   * puede dispararse manualmente desde el panel de Partidos.
   */
  async assignGroupMatches() {
    const groups = await this.ensureGroups();
    let assigned = 0;
    let pendingGroups = 0;
    for (const g of groups) {
      const teams = await this.teams.find({
        where: { groupId: g.id },
        order: { createdAt: 'ASC' },
      });
      if (teams.length < 4) pendingGroups++;
      for (let i = 0; i < ROUND_ROBIN.length; i++) {
        const code = `G${g.name}-${i + 1}`;
        const match = await this.matches.findOne({ where: { matchCode: code } });
        if (!match || match.status === MatchStatus.FINISHED) continue;
        const [hi, ai] = ROUND_ROBIN[i];
        const home = teams[hi];
        const away = teams[ai];
        match.teamHomeId = home ? home.id : null;
        match.teamAwayId = away ? away.id : null;
        await this.matches.save(match);
        if (home && away) assigned++;
      }
    }
    return { ok: true, assigned, pendingGroups };
  }

  /**
   * Reconstruye las filas de standings para los equipos ya asignados a grupos,
   * sin re-sortear ni tocar partidos. Crea las que falten (en cero). Útil si las
   * tablas se perdieron pero el sorteo (equipo→grupo) sigue intacto. Los puntos
   * se recalculan solos al cargar resultados.
   */
  async rebuildStandings() {
    const groups = await this.ensureGroups();
    let created = 0;
    let teamsInGroups = 0;
    for (const g of groups) {
      const teams = await this.teams.find({ where: { groupId: g.id } });
      teamsInGroups += teams.length;
      for (const t of teams) {
        const existing = await this.standings.findOne({
          where: { groupId: g.id, teamId: t.id },
        });
        if (!existing) {
          await this.standings.save(
            this.standings.create({ groupId: g.id, teamId: t.id }),
          );
          created++;
        }
      }
    }
    return { ok: true, created, teamsInGroups };
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
    await this.assignGroupMatches();
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
    await this.assignGroupMatches();
    return this.findAll();
  }
}

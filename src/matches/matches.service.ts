import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CoinTransaction,
  Group,
  GroupStanding,
  Match,
  PlayerStat,
  Prediction,
  TournamentSettings,
  User,
} from '../entities';
import {
  MatchPhase,
  MatchStatus,
  TransactionType,
} from '../common/enums';
import {
  buildMatchSkeleton,
  expectedMatchCount,
  groupLettersFor,
} from '../common/tournament';

interface StatInput {
  userId: string;
  teamId: string;
  goals?: number;
  assists?: number;
  saves?: number;
  score?: number;
  shots?: number;
  demos?: number;
  mvp?: boolean;
}

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(GroupStanding)
    private readonly standings: Repository<GroupStanding>,
    @InjectRepository(PlayerStat)
    private readonly playerStats: Repository<PlayerStat>,
    @InjectRepository(Prediction)
    private readonly predictions: Repository<Prediction>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CoinTransaction)
    private readonly transactions: Repository<CoinTransaction>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(TournamentSettings)
    private readonly settings: Repository<TournamentSettings>,
  ) {}

  /**
   * Genera el esqueleto de partidos (grupos + llave) según el nº de equipos
   * configurado. Crea los partidos SIN equipos ni fecha.
   *
   * Protección: si algún partido ya tiene resultado (marcador, ganador o
   * estado finalizado) se rechaza, para no destruir datos en curso. Si no,
   * borra partidos + standings previos y regenera desde cero.
   */
  async generateBracket(preserveDates = false) {
    const settings = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    const teamCount = settings?.teamCapacity ?? 16;

    const existing = await this.matches.find();
    const hasResults = existing.some(
      (m) =>
        m.homeScore != null ||
        m.awayScore != null ||
        m.winnerId != null ||
        m.status === MatchStatus.FINISHED,
    );
    if (hasResults) {
      throw new BadRequestException(
        'Hay partidos con resultado cargado. Borra o revierte los resultados antes de regenerar la llave.',
      );
    }

    // Si se piden conservar, guardamos las fechas por código de partido para
    // reasignarlas a los partidos recreados con el mismo código.
    const dateByCode = new Map<string, Date | null>();
    if (preserveDates) {
      for (const m of existing) dateByCode.set(m.matchCode, m.scheduledAt);
    }

    // Limpieza: standings y partidos previos (sin resultados, es seguro).
    await this.standings.createQueryBuilder().delete().execute();
    await this.matches.createQueryBuilder().delete().execute();

    // Garantizar los grupos correctos (A–D ó A–H) y mapear letra → id.
    const letters = groupLettersFor(teamCount);
    const existingGroups = await this.groups.find();
    const byName = new Map(existingGroups.map((g) => [g.name, g]));
    for (const name of letters) {
      if (!byName.has(name)) {
        const g = await this.groups.save(this.groups.create({ name }));
        byName.set(name, g);
      }
    }

    const skeleton = buildMatchSkeleton(teamCount);
    let datesKept = 0;
    for (const m of skeleton) {
      const scheduledAt = preserveDates ? dateByCode.get(m.code) ?? null : null;
      if (scheduledAt) datesKept++;
      await this.matches.save(
        this.matches.create({
          matchCode: m.code,
          phase: m.phase,
          format: m.format,
          groupId: m.group ? byName.get(m.group)!.id : null,
          roundNumber: m.round ?? null,
          scheduledAt,
        }),
      );
    }

    return { ok: true, created: skeleton.length, teamCount, datesKept };
  }

  /** Conteo de partidos esperado para el nº de equipos configurado. */
  async expected() {
    const settings = await this.settings.findOne({
      where: {},
      order: { updatedAt: 'DESC' },
    });
    const teamCount = settings?.teamCapacity ?? 16;
    return { teamCount, expected: expectedMatchCount(teamCount) };
  }

  findAll() {
    return this.matches.find({
      relations: { teamHome: true, teamAway: true, group: true },
      order: { scheduledAt: 'ASC' },
    });
  }

  async schedule() {
    const all = await this.findAll();
    const byDate: Record<string, Match[]> = {};
    for (const m of all) {
      const key = m.scheduledAt
        ? new Date(m.scheduledAt).toISOString().slice(0, 10)
        : 'sin-fecha';
      (byDate[key] ||= []).push(m);
    }
    return byDate;
  }

  async findOne(id: string) {
    const match = await this.matches.findOne({
      where: { id },
      relations: { teamHome: true, teamAway: true, group: true },
    });
    if (!match) throw new NotFoundException('Partido no encontrado');
    const stats = await this.playerStats.find({
      where: { matchId: id },
      relations: { user: true, team: true },
    });
    return { ...match, playerStats: stats };
  }

  bracket() {
    return this.matches.find({
      where: [
        { phase: MatchPhase.ROUND16 },
        { phase: MatchPhase.QUARTERS },
        { phase: MatchPhase.SEMIS },
        { phase: MatchPhase.THIRD },
        { phase: MatchPhase.FINAL },
      ],
      relations: { teamHome: true, teamAway: true },
      order: { scheduledAt: 'ASC' },
    });
  }

  create(data: Partial<Match>) {
    return this.matches.save(this.matches.create(data));
  }

  async assignTeams(
    id: string,
    data: { teamHomeId: string | null; teamAwayId: string | null },
  ) {
    const match = await this.matches.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    match.teamHomeId = data.teamHomeId;
    match.teamAwayId = data.teamAwayId;
    await this.matches.save(match);
    return match;
  }

  /**
   * Convierte un valor a Date válido o null. Lanza 400 (no 500) si la fecha
   * recibida es inválida, para que el front muestre un error legible.
   */
  private parseScheduledAt(value: string | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Fecha inválida: "${value}"`);
    }
    return d;
  }

  /** Asigna (o limpia) la fecha/hora de un partido. `null` → sin fecha. */
  async updateSchedule(id: string, scheduledAt: string | null) {
    const match = await this.matches.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    match.scheduledAt = this.parseScheduledAt(scheduledAt);
    await this.matches.save(match);
    return match;
  }

  /** Agenda masiva: aplica una lista de { id, scheduledAt } en lote. */
  async scheduleBulk(items: { id: string; scheduledAt: string | null }[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('No hay partidos para programar');
    }
    // Validar TODAS las fechas antes de tocar la BD (todo o nada).
    const parsed = items.map((it) => ({
      id: it.id,
      date: this.parseScheduledAt(it.scheduledAt),
    }));
    let updated = 0;
    for (const it of parsed) {
      const match = await this.matches.findOne({ where: { id: it.id } });
      if (!match) continue;
      match.scheduledAt = it.date;
      await this.matches.save(match);
      updated++;
    }
    return { ok: true, updated };
  }

  /** Marca o quita el estado "en vivo". `live=false` lo devuelve a programado. */
  async markLive(id: string, live = true) {
    const match = await this.matches.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    if (match.status === MatchStatus.FINISHED) {
      throw new BadRequestException(
        'El partido ya está finalizado. Revierte el resultado antes de cambiar su estado.',
      );
    }
    match.status = live ? MatchStatus.LIVE : MatchStatus.SCHEDULED;
    await this.matches.save(match);
    return match;
  }

  async loadResult(
    id: string,
    data: { homeScore: number; awayScore: number; stats?: StatInput[] },
  ) {
    const match = await this.matches.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Partido no encontrado');

    match.homeScore = data.homeScore;
    match.awayScore = data.awayScore;
    match.status = MatchStatus.FINISHED;
    match.playedAt = new Date();
    if (data.homeScore > data.awayScore) match.winnerId = match.teamHomeId;
    else if (data.awayScore > data.homeScore) match.winnerId = match.teamAwayId;
    else match.winnerId = null;
    await this.matches.save(match);

    // stats individuales
    if (data.stats?.length) {
      await this.playerStats.delete({ matchId: id });
      for (const s of data.stats) {
        await this.playerStats.save(
          this.playerStats.create({
            matchId: id,
            userId: s.userId,
            teamId: s.teamId,
            goals: s.goals ?? 0,
            assists: s.assists ?? 0,
            saves: s.saves ?? 0,
            score: s.score ?? 0,
            shots: s.shots ?? 0,
            demos: s.demos ?? 0,
            mvp: s.mvp ?? false,
          }),
        );
      }
    }

    if (match.phase === MatchPhase.GROUPS && match.groupId) {
      await this.recomputeStandings(match.groupId);
    }
    await this.evaluatePredictions(match);

    return this.findOne(id);
  }

  private async recomputeStandings(groupId: string) {
    const rows = await this.standings.find({ where: { groupId } });
    const map = new Map<string, GroupStanding>();
    for (const r of rows) {
      Object.assign(r, {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        position: null,
      });
      map.set(r.teamId, r);
    }

    const finished = await this.matches.find({
      where: { groupId, status: MatchStatus.FINISHED },
    });
    for (const m of finished) {
      if (
        m.homeScore == null ||
        m.awayScore == null ||
        !m.teamHomeId ||
        !m.teamAwayId
      )
        continue;
      const home = map.get(m.teamHomeId);
      const away = map.get(m.teamAwayId);
      if (!home || !away) continue;
      home.played++;
      away.played++;
      home.goalsFor += m.homeScore;
      home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore;
      away.goalsAgainst += m.homeScore;
      if (m.homeScore > m.awayScore) {
        home.won++;
        home.points += 3;
        away.lost++;
      } else if (m.awayScore > m.homeScore) {
        away.won++;
        away.points += 3;
        home.lost++;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    }

    const sorted = [...map.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gd = b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
      if (gd !== 0) return gd;
      return b.goalsFor - a.goalsFor;
    });
    sorted.forEach((s, i) => (s.position = i + 1));
    await this.standings.save(sorted);
  }

  private async evaluatePredictions(match: Match) {
    const preds = await this.predictions.find({ where: { matchId: match.id } });
    for (const p of preds) {
      let coins = 2; // participación
      let correct = false;
      if (p.predictedWinnerId && p.predictedWinnerId === match.winnerId) {
        correct = true;
        coins += 10;
        if (
          p.predictedHomeScore === match.homeScore &&
          p.predictedAwayScore === match.awayScore
        ) {
          coins += 15; // marcador exacto -> total 25 + 2 participación
        }
      }
      p.isCorrect = correct;
      p.coinsEarned = coins;
      await this.predictions.save(p);

      const user = await this.users.findOne({ where: { id: p.userId } });
      if (user) {
        user.coins += coins;
        await this.users.save(user);
        await this.transactions.save(
          this.transactions.create({
            userId: user.id,
            amount: coins,
            concept: `Predicción ${match.matchCode}`,
            transactionType: TransactionType.EARNED,
            matchId: match.id,
          }),
        );
      }
    }
  }
}

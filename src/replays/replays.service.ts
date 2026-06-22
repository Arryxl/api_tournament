import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Match, Replay, TeamMember } from '../entities';
import { LinkedPlatform, MatchFormat, ReplayStatus, UserRole } from '../common/enums';
import { LinkingService } from '../linking/linking.service';
import { MatchesService } from '../matches/matches.service';
import {
  BallchasingClient,
  BallchasingPlayer,
  ParsedReplay,
} from './ballchasing.client';

interface ResolvedPlayer extends BallchasingPlayer {
  userId: string | null;
  teamId: string | null;
}

@Injectable()
export class ReplaysService {
  constructor(
    @InjectRepository(Replay) private readonly replays: Repository<Replay>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
    private readonly ballchasing: BallchasingClient,
    private readonly linking: LinkingService,
    private readonly matchesService: MatchesService,
  ) {}

  // ---- Ingesta -------------------------------------------------------------

  async ingest(
    file: Express.Multer.File,
    matchCode: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Replay> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió el archivo .replay');
    }
    if (!matchCode) {
      throw new BadRequestException('Falta el código de partido (matchCode)');
    }

    // Dedupe por contenido: el mismo archivo no se reprocesa.
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.replays.findOne({ where: { fileHash } });
    if (existing) return existing;

    // Partido destino + autorización (miembro de uno de los 2 equipos o admin).
    const match = await this.matches.findOne({ where: { matchCode } });
    if (!match) throw new NotFoundException(`Partido ${matchCode} no encontrado`);
    if (userRole !== UserRole.ADMIN) {
      const member = await this.members.findOne({ where: { userId } });
      const teamId = member?.teamId;
      if (
        !teamId ||
        (teamId !== match.teamHomeId && teamId !== match.teamAwayId)
      ) {
        throw new ForbiddenException(
          'Solo un jugador de este partido (o un admin) puede subir su replay',
        );
      }
    }

    // En series, no aceptar más juegos si ya está decidida (un equipo llegó a
    // la mayoría: 2 en BO3, 3 en BO5, 4 en BO7).
    if (match.format !== MatchFormat.SINGLE) {
      const s = await this.seriesScore(match);
      if (s.decided) {
        throw new BadRequestException(
          `La serie ya está decidida (${s.home}–${s.away}). No se pueden añadir más juegos.`,
        );
      }
    }

    // Subir a ballchasing.
    const { id: ballchasingId } = await this.ballchasing.upload(
      file.buffer,
      file.originalname || 'match.replay',
    );

    // Si ese replay de ballchasing ya está importado, no duplicar.
    const already = await this.replays.findOne({
      where: { ballchasingId, status: ReplayStatus.IMPORTED },
    });
    if (already) return already;

    let replay = this.replays.create({
      matchId: match.id,
      uploadedById: userId,
      ballchasingId,
      fileHash,
      originalName: file.originalname ?? null,
      status: ReplayStatus.PROCESSING,
    });
    replay = await this.replays.save(replay);

    return this.process(replay, match);
  }

  /** Espera el parseo de ballchasing y resuelve el match. */
  private async process(replay: Replay, match: Match): Promise<Replay> {
    let parsed: ParsedReplay;
    try {
      parsed = await this.pollParsed(replay.ballchasingId!);
    } catch (err: any) {
      return this.save(replay, {
        status: ReplayStatus.PROCESSING,
        reviewReason: `Esperando a ballchasing: ${err?.message ?? 'reintenta'}`,
      });
    }

    if (parsed.status === 'failed') {
      return this.save(replay, {
        status: ReplayStatus.FAILED,
        reviewReason: 'ballchasing no pudo parsear el replay',
        processedAt: new Date(),
      });
    }
    if (parsed.status !== 'ok') {
      // Aún en cola en ballchasing: se puede reprocesar más tarde.
      return this.save(replay, { status: ReplayStatus.PROCESSING });
    }

    return this.matchAndImport(replay, parsed, match);
  }

  private async pollParsed(ballchasingId: string): Promise<ParsedReplay> {
    const tries = parseInt(process.env.BALLCHASING_POLL_TRIES || '10', 10);
    const interval = parseInt(process.env.BALLCHASING_POLL_INTERVAL || '3000', 10);
    let last: ParsedReplay | null = null;
    for (let i = 0; i < tries; i++) {
      last = await this.ballchasing.getReplay(ballchasingId);
      if (last.status !== 'pending') return last;
      await new Promise((r) => setTimeout(r, interval));
    }
    return last!;
  }

  // ---- Matcher -------------------------------------------------------------

  private async matchAndImport(
    replay: Replay,
    parsed: ParsedReplay,
    match: Match,
  ): Promise<Replay> {
    const players = await this.resolvePlayers(parsed.players);
    return this.importResolved(
      replay,
      players,
      parsed.blueGoals,
      parsed.orangeGoals,
      match,
    );
  }

  /**
   * Valida e importa a partir de jugadores ya resueltos (auto o manualmente).
   * Si algo no cuadra, deja el replay en revisión sin escribir stats.
   */
  private async importResolved(
    replay: Replay,
    players: ResolvedPlayer[],
    blueGoals: number,
    orangeGoals: number,
    match: Match,
  ): Promise<Replay> {
    const c = this.computeImport(players, blueGoals, orangeGoals, match);

    if (c.reasons.length > 0) {
      return this.save(replay, {
        status: ReplayStatus.NEEDS_REVIEW,
        reviewReason: c.reasons.join(' · '),
        rawStats: c.raw,
        processedAt: new Date(),
      });
    }

    // Guardar este replay como un juego importado (con el marcador del juego
    // orientado al partido) ANTES de consolidar, para que la consolidación lo
    // cuente.
    const saved = await this.save(replay, {
      status: ReplayStatus.IMPORTED,
      matchId: match.id,
      homeScore: c.homeScore,
      awayScore: c.awayScore,
      reviewReason: null,
      rawStats: c.raw,
      processedAt: new Date(),
    });

    if (match.format === MatchFormat.SINGLE) {
      // Fase de grupos: un replay = el resultado del partido (goles).
      await this.matchesService.loadResult(match.id, {
        homeScore: c.homeScore,
        awayScore: c.awayScore,
        stats: c.stats,
      });
    } else {
      // Eliminatorias: serie de varios juegos. Recalcular el partido sumando
      // todos los replays/juegos importados.
      await this.consolidateSeries(match);
    }

    return saved;
  }

  /** Juegos necesarios para ganar la serie: bo3→2, bo5→3, bo7→4, single→1. */
  private gamesNeeded(format: string): number {
    const n = format === 'bo7' ? 7 : format === 'bo5' ? 5 : format === 'bo3' ? 3 : 1;
    return Math.floor(n / 2) + 1;
  }

  /** Juegos ganados por cada equipo en la serie y si ya está decidida. */
  private async seriesScore(
    match: Match,
  ): Promise<{ home: number; away: number; decided: boolean }> {
    const games = await this.replays.find({
      where: { matchId: match.id, status: ReplayStatus.IMPORTED },
    });
    let home = 0;
    let away = 0;
    for (const g of games) {
      if (g.homeScore == null || g.awayScore == null) continue;
      if (g.homeScore > g.awayScore) home++;
      else if (g.awayScore > g.homeScore) away++;
    }
    const needed = this.gamesNeeded(match.format);
    return { home, away, decided: home >= needed || away >= needed };
  }

  /**
   * Consolida una serie eliminatoria: cuenta juegos ganados por cada equipo,
   * suma las stats core de cada jugador a lo largo de todos los juegos y
   * promedia las métricas avanzadas. Finaliza el partido si alguien llegó a
   * la mayoría de juegos.
   */
  private async consolidateSeries(match: Match): Promise<void> {
    const games = await this.replays.find({
      where: { matchId: match.id, status: ReplayStatus.IMPORTED },
    });

    let gamesHome = 0;
    let gamesAway = 0;
    const agg = new Map<string, any>();
    const extraAcc = new Map<string, { sum: any; n: number }>();

    for (const g of games) {
      if (g.homeScore == null || g.awayScore == null) continue;
      if (g.homeScore > g.awayScore) gamesHome++;
      else if (g.awayScore > g.homeScore) gamesAway++;

      const raw = g.rawStats as any;
      for (const p of raw?.players ?? []) {
        if (!p.userId || !p.teamId) continue;
        const cur =
          agg.get(p.userId) ??
          {
            userId: p.userId,
            teamId: p.teamId,
            goals: 0, assists: 0, saves: 0, score: 0, shots: 0, demos: 0,
          };
        cur.goals += p.goals || 0;
        cur.assists += p.assists || 0;
        cur.saves += p.saves || 0;
        cur.score += p.score || 0;
        cur.shots += p.shots || 0;
        cur.demos += p.demos || 0;
        agg.set(p.userId, cur);

        if (p.extra) {
          const e = extraAcc.get(p.userId) ?? { sum: {}, n: 0 };
          this.deepAddExtra(e.sum, p.extra);
          e.n++;
          extraAcc.set(p.userId, e);
        }
      }
    }

    // MVP de la serie: el jugador con más score acumulado.
    let mvpUser: string | null = null;
    let maxScore = -1;
    for (const [uid, s] of agg) {
      if (s.score > maxScore) {
        maxScore = s.score;
        mvpUser = uid;
      }
    }

    const stats = [...agg.values()].map((s) => ({
      userId: s.userId,
      teamId: s.teamId,
      goals: s.goals,
      assists: s.assists,
      saves: s.saves,
      score: s.score,
      shots: s.shots,
      demos: s.demos,
      mvp: s.userId === mvpUser,
      extra: extraAcc.has(s.userId) ? this.avgExtra(extraAcc.get(s.userId)!) : null,
    }));

    const needed = this.gamesNeeded(match.format);
    const finished = gamesHome >= needed || gamesAway >= needed;

    await this.matchesService.applySeries(match.id, {
      homeScore: gamesHome,
      awayScore: gamesAway,
      stats,
      finished,
    });
  }

  /** Suma in-place las métricas avanzadas anidadas (boost/movement/positioning). */
  private deepAddExtra(sum: any, e: any): void {
    for (const group of Object.keys(e)) {
      sum[group] ??= {};
      for (const key of Object.keys(e[group])) {
        sum[group][key] = (sum[group][key] ?? 0) + (e[group][key] ?? 0);
      }
    }
  }

  /** Promedia las métricas avanzadas acumuladas sobre los juegos del jugador. */
  private avgExtra({ sum, n }: { sum: any; n: number }): any {
    if (n <= 0) return sum;
    const out: any = {};
    for (const group of Object.keys(sum)) {
      out[group] = {};
      for (const key of Object.keys(sum[group])) {
        out[group][key] = Math.round((sum[group][key] / n) * 100) / 100;
      }
    }
    return out;
  }

  /**
   * Resuelve color→equipo, valida y arma el marcador + stats por jugador.
   * Devuelve `reasons` (vacío si todo cuadra) sin escribir nada en BD.
   * El marcador se calcula best-effort aunque haya avisos (para la previsualización).
   */
  private computeImport(
    players: ResolvedPlayer[],
    blueGoals: number,
    orangeGoals: number,
    match: Match,
  ) {
    const unresolved = players.filter((p) => !p.teamId).map((p) => p.name);
    const blueTeam = this.majorityTeam(players, 'blue');
    const orangeTeam = this.majorityTeam(players, 'orange');

    const reasons: string[] = [];
    if (players.length === 0) reasons.push('El replay no tiene jugadores');
    if (unresolved.length > 0)
      reasons.push(`Jugadores sin cuenta vinculada: ${unresolved.join(', ')}`);
    if (!blueTeam || !orangeTeam || blueTeam === orangeTeam)
      reasons.push('No se pudieron determinar 2 equipos distintos');
    if (!match.teamHomeId || !match.teamAwayId)
      reasons.push('El partido no tiene equipos asignados');
    else {
      const matchTeams = new Set([match.teamHomeId, match.teamAwayId]);
      if (!blueTeam || !orangeTeam || !matchTeams.has(blueTeam) || !matchTeams.has(orangeTeam))
        reasons.push('Los equipos del replay no coinciden con los del partido');
    }

    // Mapear color → home/away según el equipo local (best-effort).
    const homeIsBlue = match.teamHomeId
      ? match.teamHomeId === blueTeam
      : true;
    const homeScore = homeIsBlue ? blueGoals : orangeGoals;
    const awayScore = homeIsBlue ? orangeGoals : blueGoals;

    const stats = players
      .filter((p) => p.userId && p.teamId)
      .map((p) => ({
        userId: p.userId!,
        teamId: p.teamId!,
        name: p.name,
        goals: p.goals,
        assists: p.assists,
        saves: p.saves,
        score: p.score,
        shots: p.shots,
        demos: p.demos,
        mvp: p.mvp,
        extra: p.extra,
      }));

    const raw = {
      blueGoals,
      orangeGoals,
      players,
      resolution: { blueTeam, orangeTeam, unresolved },
    };

    return { reasons, blueTeam, orangeTeam, unresolved, homeScore, awayScore, stats, raw };
  }

  /**
   * Previsualiza un replay para el editor de Resultado del admin: parsea,
   * resuelve y devuelve marcador + stats por jugador SIN escribir en BD. El
   * admin revisa, ajusta y guarda con el flujo normal de resultado.
   */
  async preview(file: Express.Multer.File, matchCode: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió el archivo .replay');
    }
    if (!matchCode) {
      throw new BadRequestException('Falta el código de partido (matchCode)');
    }
    const match = await this.matches.findOne({ where: { matchCode } });
    if (!match) throw new NotFoundException(`Partido ${matchCode} no encontrado`);

    const { id: ballchasingId } = await this.ballchasing.upload(
      file.buffer,
      file.originalname || 'match.replay',
    );
    const parsed = await this.pollParsed(ballchasingId);
    if (parsed.status !== 'ok') {
      throw new BadRequestException(
        'ballchasing aún está parseando el replay; reintenta en unos segundos',
      );
    }

    const players = await this.resolvePlayers(parsed.players);
    const c = this.computeImport(
      players,
      parsed.blueGoals,
      parsed.orangeGoals,
      match,
    );

    return {
      matchCode,
      homeScore: c.homeScore,
      awayScore: c.awayScore,
      stats: c.stats,
      unresolved: c.unresolved,
      warnings: c.reasons,
    };
  }

  private async resolvePlayers(
    players: BallchasingPlayer[],
  ): Promise<ResolvedPlayer[]> {
    return Promise.all(
      players.map(async (p) => {
        const platform = this.toPlatform(p.platform);
        if (!platform) return { ...p, userId: null, teamId: null };
        // En consola ballchasing suele no traer un ID estable: el dato que
        // cruza con lo declarado en la inscripción es el nombre en pantalla.
        const isConsole =
          platform !== LinkedPlatform.STEAM && platform !== LinkedPlatform.EPIC;
        const key = isConsole && !p.platformId ? p.name : p.platformId;
        const link = await this.linking.resolveByPlatformId(platform, key);
        if (!link) return { ...p, userId: null, teamId: null };
        const member = await this.members.findOne({
          where: { userId: link.userId },
        });
        return { ...p, userId: link.userId, teamId: member?.teamId ?? null };
      }),
    );
  }

  private toPlatform(value: string): LinkedPlatform | null {
    switch (value) {
      case 'steam':
        return LinkedPlatform.STEAM;
      case 'epic':
        return LinkedPlatform.EPIC;
      // ballchasing usa estos identificadores para consola.
      case 'ps4':
      case 'ps5':
      case 'psn':
      case 'playstation':
        return LinkedPlatform.PSN;
      case 'xbox':
      case 'xboxone':
        return LinkedPlatform.XBOX;
      case 'switch':
      case 'nintendo':
        return LinkedPlatform.SWITCH;
      default:
        return null;
    }
  }

  /** Equipo mayoritario entre los jugadores resueltos de un color. */
  private majorityTeam(
    players: ResolvedPlayer[],
    color: 'blue' | 'orange',
  ): string | null {
    const counts = new Map<string, number>();
    for (const p of players) {
      if (p.color === color && p.teamId) {
        counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
      }
    }
    let best: string | null = null;
    let max = 0;
    for (const [teamId, n] of counts) {
      if (n > max) {
        max = n;
        best = teamId;
      }
    }
    return best;
  }

  // ---- Consultas / admin ---------------------------------------------------

  private save(replay: Replay, patch: Partial<Replay>): Promise<Replay> {
    Object.assign(replay, patch);
    return this.replays.save(replay);
  }

  list() {
    return this.replays.find({
      relations: { match: true, uploadedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const replay = await this.replays.findOne({
      where: { id },
      relations: { match: true, uploadedBy: true },
    });
    if (!replay) throw new NotFoundException('Replay no encontrado');
    return replay;
  }

  /** Reintenta el parseo/match de un replay (processing/needs_review/failed). */
  async reprocess(id: string) {
    const replay = await this.findOne(id);
    if (!replay.ballchasingId) {
      throw new BadRequestException('El replay no tiene id de ballchasing');
    }
    const match = replay.matchId
      ? await this.matches.findOne({ where: { id: replay.matchId } })
      : null;
    if (!match) throw new BadRequestException('El replay no tiene partido asignado');
    return this.process(replay, match);
  }

  async remove(id: string) {
    await this.replays.delete({ id });
    return { ok: true };
  }

  /**
   * Corrección manual desde el panel: el admin asigna cada jugador del replay a
   * un usuario/equipo y (opcional) cambia el partido destino. Reusa los datos
   * ya parseados (`rawStats`) y vuelve a validar e importar.
   */
  async manualResolve(
    id: string,
    body: {
      matchCode?: string;
      assignments?: {
        platform: string;
        platformId: string;
        userId: string;
        teamId: string;
      }[];
    },
  ): Promise<Replay> {
    const replay = await this.findOne(id);
    const raw = replay.rawStats as any;
    if (!raw?.players?.length) {
      throw new BadRequestException(
        'El replay no tiene datos parseados; usa "Reprocesar" primero',
      );
    }

    // Reconstruir los jugadores desde rawStats y aplicar las asignaciones.
    const byKey = new Map(
      (body.assignments ?? []).map((a) => [
        `${a.platform}|${a.platformId}`,
        a,
      ]),
    );
    const players: ResolvedPlayer[] = raw.players.map((p: ResolvedPlayer) => {
      const a = byKey.get(`${p.platform}|${p.platformId}`);
      return a ? { ...p, userId: a.userId, teamId: a.teamId } : { ...p };
    });

    const matchCode = body.matchCode || replay.match?.matchCode;
    const match = matchCode
      ? await this.matches.findOne({ where: { matchCode } })
      : replay.matchId
        ? await this.matches.findOne({ where: { id: replay.matchId } })
        : null;
    if (!match) throw new BadRequestException('Partido destino no encontrado');

    return this.importResolved(
      replay,
      players,
      raw.blueGoals ?? 0,
      raw.orangeGoals ?? 0,
      match,
    );
  }
}

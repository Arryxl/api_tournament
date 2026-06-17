import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import {
  CoinTransaction,
  Group,
  GroupStanding,
  Match,
  PlayerStat,
  Prediction,
  PredictionWindow,
  Reward,
  RewardRedemption,
  Team,
  TeamMember,
  TournamentSettings,
  User,
} from '../entities';
import {
  MatchFormat,
  MatchPhase,
  MatchStatus,
  PlayerRank,
  RedemptionStatus,
  TeamStatus,
  TransactionType,
  UserRole,
} from '../common/enums';

dotenv.config();

/**
 * SEED — TORNEO A MITAD DE CAMINO (semifinales PENDIENTES de jugar)
 *
 *   Fase de grupos ...... TERMINADA  (resultados + tablas)
 *   Cuartos ............. TERMINADOS
 *   Semifinales ......... PROGRAMADAS (equipos clasificados, sin jugar) ← lo próximo
 *   3er puesto / Final .. PROGRAMADAS (rivales por definir)
 *
 *   16 equipos · 80 jugadores (3 titulares + 2 suplentes c/u) con credenciales.
 *   Predicciones de fans en lo ya jugado + ventana ABIERTA para las semis.
 *
 * Es idempotente: si ya hay equipos cargados, no duplica los datos de demo.
 */

interface MatchSeed {
  code: string;
  phase: MatchPhase;
  format: MatchFormat;
  date: string;
  group?: string;
  round?: number;
}

const groupLetters = ['A', 'B', 'C', 'D'];
const groupDates: Record<string, string[]> = {
  A: ['2025-07-25', '2025-07-25', '2025-07-28', '2025-07-28', '2025-07-31', '2025-07-31'],
  B: ['2025-07-25', '2025-07-25', '2025-07-28', '2025-07-28', '2025-07-31', '2025-07-31'],
  C: ['2025-07-27', '2025-07-27', '2025-07-29', '2025-07-29', '2025-08-01', '2025-08-01'],
  D: ['2025-07-27', '2025-07-27', '2025-07-29', '2025-07-29', '2025-08-01', '2025-08-01'],
};

const GROUP_MATCHES: MatchSeed[] = [];
for (const g of groupLetters) {
  for (let i = 1; i <= 6; i++) {
    GROUP_MATCHES.push({
      code: `G${g}-${i}`,
      phase: MatchPhase.GROUPS,
      format: MatchFormat.BO3,
      date: groupDates[g][i - 1] + 'T20:00:00',
      group: g,
      round: Math.ceil(i / 2),
    });
  }
}

const KNOCKOUT: MatchSeed[] = [
  { code: 'Q01', phase: MatchPhase.QUARTERS, format: MatchFormat.BO3, date: '2025-08-05T20:00:00' },
  { code: 'Q02', phase: MatchPhase.QUARTERS, format: MatchFormat.BO3, date: '2025-08-05T21:30:00' },
  { code: 'Q03', phase: MatchPhase.QUARTERS, format: MatchFormat.BO3, date: '2025-08-08T20:00:00' },
  { code: 'Q04', phase: MatchPhase.QUARTERS, format: MatchFormat.BO3, date: '2025-08-08T21:30:00' },
  { code: 'SF1', phase: MatchPhase.SEMIS, format: MatchFormat.BO5, date: '2025-08-12T20:00:00' },
  { code: 'SF2', phase: MatchPhase.SEMIS, format: MatchFormat.BO5, date: '2025-08-15T20:00:00' },
  { code: '3L', phase: MatchPhase.THIRD, format: MatchFormat.BO7, date: '2025-08-21T20:00:00' },
  { code: 'GF', phase: MatchPhase.FINAL, format: MatchFormat.BO7, date: '2025-08-23T20:00:00' },
];

const REWARDS = [
  { name: 'Rol especial en Discord', description: 'Rol exclusivo de Gravity en el servidor.', costCoins: 100, stock: null },
  { name: 'Mención en stream', description: 'Shoutout en la transmisión en vivo.', costCoins: 60, stock: 20 },
  { name: 'Merchandise Gravity', description: 'Sticker pack oficial del torneo.', costCoins: 250, stock: 10 },
];

// 16 equipos (4 por grupo, orden = siembra t0..t3 dentro del grupo)
const TEAMS: { name: string; group: string }[] = [
  { name: 'Nova Boost', group: 'A' }, { name: 'Apex Drift', group: 'A' }, { name: 'Neon Surge', group: 'A' }, { name: 'Vortex RL', group: 'A' },
  { name: 'Iron Aerial', group: 'B' }, { name: 'Lunar Demo', group: 'B' }, { name: 'Pulse Squad', group: 'B' }, { name: 'Hightower', group: 'B' },
  { name: 'Zero Gravity', group: 'C' }, { name: 'Comet Crew', group: 'C' }, { name: 'Bouncebox', group: 'C' }, { name: 'Redline', group: 'C' },
  { name: 'Solar Flare', group: 'D' }, { name: 'Phantom Air', group: 'D' }, { name: 'Octane Kings', group: 'D' }, { name: 'Gravity FC', group: 'D' },
];
// Rangos para titulares (1-3) y suplentes (4-5).
const RANKS = [PlayerRank.CHAMP1, PlayerRank.CHAMP2, PlayerRank.DIA3, PlayerRank.DIA2, PlayerRank.PLAT4, PlayerRank.CHAMP3, PlayerRank.DIA1, PlayerRank.PLAT3];
const STARTERS = 3;
const TOTAL_PLAYERS = 5; // 3 titulares + 2 suplentes

// Resultados de grupo por [homeIdx, awayIdx, homeScore, awayScore] (BO3)
const GROUP_RESULTS = [
  [0, 1, 2, 1],
  [2, 3, 2, 0],
  [0, 2, 2, 0],
  [1, 3, 2, 1],
  [0, 3, 2, 0],
  [1, 2, 2, 1],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function statsFor(winner: boolean, j: number) {
  const goals = winner ? [2, 1, 0][j] : [1, 0, 1][j];
  const assists = winner ? [1, 2, 1][j] : [0, 1, 0][j];
  const saves = (winner ? 1 : 0) + [1, 2, 3][j];
  const score = 200 + goals * 100 + assists * 50 + saves * 30 + (winner ? 150 : 0);
  return { goals, assists, saves, score, mvp: winner && j === 0 };
}

async function run() {
  await AppDataSource.initialize();
  console.log('Conectado a la base de datos.');

  const userRepo = AppDataSource.getRepository(User);
  const groupRepo = AppDataSource.getRepository(Group);
  const matchRepo = AppDataSource.getRepository(Match);
  const rewardRepo = AppDataSource.getRepository(Reward);
  const teamRepo = AppDataSource.getRepository(Team);
  const memberRepo = AppDataSource.getRepository(TeamMember);
  const standingRepo = AppDataSource.getRepository(GroupStanding);
  const statRepo = AppDataSource.getRepository(PlayerStat);
  const predRepo = AppDataSource.getRepository(Prediction);
  const windowRepo = AppDataSource.getRepository(PredictionWindow);
  const txRepo = AppDataSource.getRepository(CoinTransaction);
  const redemptionRepo = AppDataSource.getRepository(RewardRedemption);
  const settingsRepo = AppDataSource.getRepository(TournamentSettings);

  // --- Admin ---
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'gravity_admin_2025';
  let admin = await userRepo.findOne({ where: { username: adminUsername } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        username: adminUsername,
        email: 'admin@gravity.gg',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: UserRole.ADMIN,
        coins: 0,
      }),
    );
    console.log(`✔ Admin creado: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('• Admin ya existía.');
  }

  // --- Configuración del torneo: inscripciones cerradas, torneo en marcha ---
  let settings = await settingsRepo.findOne({ where: {}, order: { updatedAt: 'DESC' } });
  if (!settings) settings = settingsRepo.create({});
  settings.registrationsOpen = false;
  settings.tournamentStarted = true;
  settings.teamCapacity = 16;
  await settingsRepo.save(settings);
  console.log('✔ Configuración: inscripciones CERRADAS, torneo EN MARCHA (cupo 16).');

  // --- Grupos ---
  const groupMap = new Map<string, Group>();
  for (const name of groupLetters) {
    let g = await groupRepo.findOne({ where: { name } });
    if (!g) g = await groupRepo.save(groupRepo.create({ name }));
    groupMap.set(name, g);
  }
  console.log('✔ Grupos A, B, C, D listos.');

  // --- Partidos (estructura) ---
  for (const m of [...GROUP_MATCHES, ...KNOCKOUT]) {
    const exists = await matchRepo.findOne({ where: { matchCode: m.code } });
    if (exists) continue;
    await matchRepo.save(
      matchRepo.create({
        matchCode: m.code,
        phase: m.phase,
        format: m.format,
        scheduledAt: new Date(m.date),
        groupId: m.group ? groupMap.get(m.group)!.id : null,
        roundNumber: m.round ?? null,
      }),
    );
  }
  console.log('✔ 32 partidos listos.');

  // --- Recompensas ---
  for (const r of REWARDS) {
    const exists = await rewardRepo.findOne({ where: { name: r.name } });
    if (!exists) await rewardRepo.save(rewardRepo.create(r));
  }
  console.log('✔ Recompensas listas.');

  // ============================================================
  //  DATOS DE DEMOSTRACIÓN (solo si aún no hay equipos)
  // ============================================================
  if ((await teamRepo.count()) > 0) {
    console.log('• Ya hay equipos cargados — se omiten los datos de demo.');
    await AppDataSource.destroy();
    console.log('Seed completado.');
    return;
  }

  const pwHash = await bcrypt.hash('jugador123', 10);
  const teamsByGroup: Record<string, Team[]> = { A: [], B: [], C: [], D: [] };
  const membersByTeam = new Map<string, TeamMember[]>();
  const credentials: { team: string; username: string; rol: string }[] = [];
  let rankI = 0;

  for (const def of TEAMS) {
    const s = slug(def.name);
    const team = await teamRepo.save(
      teamRepo.create({
        name: def.name,
        status: TeamStatus.APPROVED,
        groupId: groupMap.get(def.group)!.id,
      }),
    );
    const members: TeamMember[] = [];
    let captainId: string | null = null;
    for (let n = 1; n <= TOTAL_PLAYERS; n++) {
      const username = `${s}_p${n}`;
      const user = await userRepo.save(
        userRepo.create({
          username,
          email: null,
          passwordHash: pwHash,
          role: UserRole.CANDIDATE,
          coins: 100,
        }),
      );
      await txRepo.save(
        txRepo.create({
          userId: user.id,
          amount: 100,
          concept: 'Bono de bienvenida',
          transactionType: TransactionType.ADMIN_GRANT,
        }),
      );
      const isCaptain = n === 1;
      if (isCaptain) captainId = user.id;
      const member = await memberRepo.save(
        memberRepo.create({
          teamId: team.id,
          userId: user.id,
          epicUsername: `${def.name.replace(/\s/g, '')}P${n}`,
          steamUsername: null,
          rank: RANKS[rankI % RANKS.length],
          screenshotUrl: null,
          isCaptain,
          playerNumber: n,
        }),
      );
      rankI++;
      members.push(member);
      credentials.push({
        team: def.name,
        username,
        rol: n <= STARTERS ? (isCaptain ? 'Capitán' : 'Titular') : 'Suplente',
      });
    }
    team.captainId = captainId;
    await teamRepo.save(team);
    teamsByGroup[def.group].push(team);
    membersByTeam.set(team.id, members);
  }
  console.log(`✔ 16 equipos + ${16 * TOTAL_PLAYERS} jugadores creados (3 titulares + 2 suplentes c/u, pass: jugador123).`);

  // helper: aplica resultado + stats individuales (solo titulares) a un partido
  const applyResult = async (
    code: string,
    homeTeam: Team,
    awayTeam: Team,
    hs: number,
    as: number,
    status: MatchStatus = MatchStatus.FINISHED,
  ) => {
    const match = await matchRepo.findOne({ where: { matchCode: code } });
    if (!match) return;
    match.teamHomeId = homeTeam.id;
    match.teamAwayId = awayTeam.id;
    if (status === MatchStatus.FINISHED) {
      match.homeScore = hs;
      match.awayScore = as;
      match.winnerId = hs > as ? homeTeam.id : as > hs ? awayTeam.id : null;
      match.playedAt = new Date(match.scheduledAt as Date);
    }
    match.status = status;
    await matchRepo.save(match);

    if (status !== MatchStatus.FINISHED) return match;

    for (const [team, win] of [
      [homeTeam, hs > as],
      [awayTeam, as > hs],
    ] as [Team, boolean][]) {
      const members = membersByTeam.get(team.id) || [];
      // stats solo para titulares (1-3); los suplentes no registran en este punto
      for (let j = 0; j < Math.min(STARTERS, members.length); j++) {
        const mem = members[j];
        if (!mem.userId) continue;
        const v = statsFor(win, j);
        await statRepo.save(
          statRepo.create({
            matchId: match.id,
            userId: mem.userId,
            teamId: team.id,
            goals: v.goals,
            assists: v.assists,
            saves: v.saves,
            score: v.score,
            mvp: v.mvp,
          }),
        );
      }
    }
    return match;
  };

  // --- Resultados de grupos + standings ---
  for (const g of groupLetters) {
    const teams = teamsByGroup[g];
    for (let i = 0; i < GROUP_RESULTS.length; i++) {
      const [hi, ai, hs, as] = GROUP_RESULTS[i];
      await applyResult(`G${g}-${i + 1}`, teams[hi], teams[ai], hs, as);
    }
    const acc = teams.map((t) => ({
      teamId: t.id,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    }));
    const idOf = (t: Team) => acc.find((a) => a.teamId === t.id)!;
    for (let i = 0; i < GROUP_RESULTS.length; i++) {
      const [hi, ai, hs, as] = GROUP_RESULTS[i];
      const h = idOf(teams[hi]);
      const a = idOf(teams[ai]);
      h.played++; a.played++;
      h.goalsFor += hs; h.goalsAgainst += as;
      a.goalsFor += as; a.goalsAgainst += hs;
      if (hs > as) { h.won++; h.points += 3; a.lost++; }
      else if (as > hs) { a.won++; a.points += 3; h.lost++; }
      else { h.drawn++; a.drawn++; h.points++; a.points++; }
    }
    acc.sort((x, y) =>
      y.points - x.points ||
      (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) ||
      y.goalsFor - x.goalsFor,
    );
    for (let i = 0; i < acc.length; i++) {
      await standingRepo.save(
        standingRepo.create({ ...acc[i], groupId: groupMap.get(g)!.id, position: i + 1 }),
      );
    }
  }
  console.log('✔ Fase de grupos TERMINADA + tablas calculadas.');

  // --- Cuartos (terminados) ---
  const q1 = (g: string) => teamsByGroup[g][0]; // 1° de grupo
  const q2 = (g: string) => teamsByGroup[g][1]; // 2° de grupo

  const nova = q1('A'), apex = q2('A');
  const iron = q1('B'), lunar = q2('B');
  const zero = q1('C'), comet = q2('C');
  const solar = q1('D'), phantom = q2('D');

  await applyResult('Q01', nova, lunar, 2, 1);   // Nova
  await applyResult('Q02', iron, apex, 2, 0);    // Iron
  await applyResult('Q03', zero, phantom, 2, 1); // Zero
  await applyResult('Q04', solar, comet, 2, 1);  // Solar
  console.log('✔ Cuartos TERMINADOS (clasifican: Nova, Iron, Zero, Solar).');

  // --- Semifinales PROGRAMADAS (equipos asignados, sin jugar) ---
  await applyResult('SF1', nova, solar, 0, 0, MatchStatus.SCHEDULED);
  await applyResult('SF2', iron, zero, 0, 0, MatchStatus.SCHEDULED);
  console.log('✔ Semifinales PROGRAMADAS: SF1 Nova vs Solar · SF2 Iron vs Zero (PENDIENTES).');
  // 3er puesto y Final quedan sin rivales (a definir tras las semis).

  // --- Predicciones de fans + monedas (sobre lo ya jugado) ---
  const finishedCodes = ['Q01', 'Q02', 'Q03', 'Q04'];
  const fans: User[] = [];
  for (let f = 1; f <= 5; f++) {
    const fan = await userRepo.save(
      userRepo.create({
        username: `fan${f}`,
        email: null,
        passwordHash: pwHash,
        role: UserRole.PUBLIC,
        coins: 50,
      }),
    );
    await txRepo.save(
      txRepo.create({ userId: fan.id, amount: 50, concept: 'Registro en la plataforma', transactionType: TransactionType.ADMIN_GRANT }),
    );
    fans.push(fan);
  }
  for (let f = 0; f < fans.length; f++) {
    const fan = fans[f];
    let earned = 0;
    for (let mi = 0; mi < finishedCodes.length; mi++) {
      const match = await matchRepo.findOne({ where: { matchCode: finishedCodes[mi] } });
      if (!match || !match.teamHomeId || !match.teamAwayId) continue;
      const pickHome = (f + mi) % 3 !== 0;
      const predictedWinnerId = pickHome ? match.teamHomeId : match.teamAwayId;
      const correct = predictedWinnerId === match.winnerId;
      const coins = correct ? 12 : 2;
      earned += coins;
      await predRepo.save(
        predRepo.create({
          userId: fan.id,
          matchId: match.id,
          predictedWinnerId,
          isCorrect: correct,
          coinsEarned: coins,
        }),
      );
      await txRepo.save(
        txRepo.create({ userId: fan.id, amount: coins, concept: `Predicción ${match.matchCode}`, transactionType: TransactionType.EARNED, matchId: match.id }),
      );
    }
    fan.coins += earned;
    await userRepo.save(fan);
  }
  console.log('✔ 5 fans con predicciones de cuartos y monedas.');

  // --- Ventana de predicción ABIERTA para las semifinales (lo próximo a jugar) ---
  for (const code of ['SF1', 'SF2']) {
    const sf = await matchRepo.findOne({ where: { matchCode: code } });
    if (!sf) continue;
    await windowRepo.save(
      windowRepo.create({
        matchId: sf.id,
        openFrom: new Date(Date.now() - 3600 * 1000),
        openUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        isActive: true,
        createdBy: admin.id,
      }),
    );
    sf.predictionsOpen = true;
    await matchRepo.save(sf);
  }
  console.log('✔ Predicciones ABIERTAS para SF1 y SF2.');

  // --- Canjes de recompensa (ejemplos) ---
  const mention = await rewardRepo.findOne({ where: { name: 'Mención en stream' } });
  const role = await rewardRepo.findOne({ where: { name: 'Rol especial en Discord' } });
  const buyer1 = await userRepo.findOne({ where: { username: `${slug('Nova Boost')}_p1` } });
  const buyer2 = await userRepo.findOne({ where: { username: `${slug('Zero Gravity')}_p1` } });
  if (mention && buyer1) {
    buyer1.coins -= mention.costCoins;
    await userRepo.save(buyer1);
    await txRepo.save(txRepo.create({ userId: buyer1.id, amount: -mention.costCoins, concept: `Canje: ${mention.name}`, transactionType: TransactionType.SPENT }));
    await redemptionRepo.save(redemptionRepo.create({ userId: buyer1.id, rewardId: mention.id, status: RedemptionStatus.PENDING }));
  }
  if (role && buyer2) {
    buyer2.coins -= role.costCoins;
    await userRepo.save(buyer2);
    await txRepo.save(txRepo.create({ userId: buyer2.id, amount: -role.costCoins, concept: `Canje: ${role.name}`, transactionType: TransactionType.SPENT }));
    await redemptionRepo.save(redemptionRepo.create({ userId: buyer2.id, rewardId: role.id, status: RedemptionStatus.DELIVERED, notes: 'Entregado en Discord' }));
  }
  console.log('✔ Canjes de ejemplo (1 pendiente, 1 entregado).');

  await AppDataSource.destroy();
  console.log('\n🌱 Seed de MITAD DE TORNEO completado (semifinales pendientes).');
  console.log('   Admin:    admin / gravity_admin_2025');
  console.log('   Pass de todos los jugadores y fans: jugador123\n');
  console.log('   Credenciales de jugadores (usuario / pass jugador123):');
  for (const c of credentials) {
    console.log(`     ${c.username.padEnd(22)} ${c.rol.padEnd(9)} (${c.team})`);
  }
  console.log('   Fans: fan1 … fan5 / jugador123');
}

run().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});

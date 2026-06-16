import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import {
  Group,
  Match,
  Reward,
  User,
} from '../entities';
import {
  MatchFormat,
  MatchPhase,
  UserRole,
} from '../common/enums';

dotenv.config();

interface MatchSeed {
  code: string;
  phase: MatchPhase;
  format: MatchFormat;
  date: string;
  group?: string;
  round?: number;
}

const GROUP_MATCHES: MatchSeed[] = [];
const groupLetters = ['A', 'B', 'C', 'D'];
// fechas por grupo (A/B comparten, C/D comparten)
const groupDates: Record<string, string[]> = {
  A: ['2025-07-25', '2025-07-25', '2025-07-28', '2025-07-28', '2025-07-31', '2025-07-31'],
  B: ['2025-07-25', '2025-07-25', '2025-07-28', '2025-07-28', '2025-07-31', '2025-07-31'],
  C: ['2025-07-27', '2025-07-27', '2025-07-29', '2025-07-29', '2025-08-01', '2025-08-01'],
  D: ['2025-07-27', '2025-07-27', '2025-07-29', '2025-07-29', '2025-08-01', '2025-08-01'],
};
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

async function run() {
  await AppDataSource.initialize();
  console.log('Conectado a la base de datos.');

  const userRepo = AppDataSource.getRepository(User);
  const groupRepo = AppDataSource.getRepository(Group);
  const matchRepo = AppDataSource.getRepository(Match);
  const rewardRepo = AppDataSource.getRepository(Reward);

  // --- Admin ---
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'gravity_admin_2025';
  let admin = await userRepo.findOne({ where: { username: adminUsername } });
  if (!admin) {
    admin = userRepo.create({
      username: adminUsername,
      email: 'admin@gravity.gg',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: UserRole.ADMIN,
      coins: 0,
    });
    await userRepo.save(admin);
    console.log(`✔ Admin creado: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log('• Admin ya existía, se omite.');
  }

  // --- Grupos ---
  const groupMap = new Map<string, Group>();
  for (const name of groupLetters) {
    let g = await groupRepo.findOne({ where: { name } });
    if (!g) {
      g = await groupRepo.save(groupRepo.create({ name }));
    }
    groupMap.set(name, g);
  }
  console.log('✔ Grupos A, B, C, D listos.');

  // --- Partidos ---
  const allMatches = [...GROUP_MATCHES, ...KNOCKOUT];
  let created = 0;
  for (const m of allMatches) {
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
    created++;
  }
  console.log(`✔ Partidos creados: ${created} (total esperado 32).`);

  // --- Recompensas ejemplo ---
  for (const r of REWARDS) {
    const exists = await rewardRepo.findOne({ where: { name: r.name } });
    if (!exists) {
      await rewardRepo.save(rewardRepo.create(r));
    }
  }
  console.log('✔ Recompensas de ejemplo listas.');

  await AppDataSource.destroy();
  console.log('Seed completado.');
}

run().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});

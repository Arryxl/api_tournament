import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { AppDataSource } from './data-source';
import { PresetTeam } from '../entities';
import { PRESET_TEAMS_SEED } from '../teams/preset-teams';

dotenv.config();

/**
 * Siembra el catálogo de equipos predefinidos (los 16 de la RLCS 2026) en la
 * tabla `preset_teams` y copia sus escudos empaquetados (src/assets/teams) a la
 * carpeta dedicada `UPLOAD_DIR/preset-teams/`, sirviéndolos en
 * `/uploads/preset-teams/<slug>.png`. Idempotente (upsert por slug; no
 * sobreescribe filas ya editadas desde el admin).
 */
async function run() {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const destDir = resolve(uploadDir, 'preset-teams');
  const srcDir = join(__dirname, '..', 'assets', 'teams');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(PresetTeam);

  let created = 0;
  for (let i = 0; i < PRESET_TEAMS_SEED.length; i++) {
    const s = PRESET_TEAMS_SEED[i];
    // Copia el escudo a la carpeta de uploads si existe el empaquetado.
    const srcFile = join(srcDir, `${s.slug}.png`);
    if (existsSync(srcFile)) {
      copyFileSync(srcFile, join(destDir, `${s.slug}.png`));
    }
    const existing = await repo.findOne({ where: { slug: s.slug } });
    if (existing) continue; // respeta ediciones del admin
    await repo.save(
      repo.create({
        slug: s.slug,
        name: s.name,
        region: s.region,
        placementLabel: s.placementLabel,
        logo: `/uploads/preset-teams/${s.slug}.png`,
        sortOrder: i,
      }),
    );
    created++;
  }

  console.log(
    `✔ Equipos predefinidos: ${created} creados, ${PRESET_TEAMS_SEED.length - created} ya existían. Escudos copiados a ${destDir}.`,
  );
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error('Error sembrando equipos predefinidos:', err);
  process.exit(1);
});

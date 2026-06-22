import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amplía los enums de rango a la escalera COMPLETA de Rocket League
 * (Bronce 1 → Supersonic Legend) para que el rango permitido del torneo sea
 * totalmente configurable. Afecta `team_members_rank_enum` y
 * `recruitment_rank_enum` (recruitment_posts, join_requests, player_profiles).
 * `registration_forms.playerN_rank` es varchar, no requiere cambios.
 * Idempotente (ADD VALUE IF NOT EXISTS).
 */
const NEW_RANKS = [
  'bronze1', 'bronze2', 'bronze3',
  'silver1', 'silver2', 'silver3',
  'gold1', 'gold2', 'gold3',
  'plat1', 'plat2',
  'gc2', 'gc3', 'ssl',
];

export class FullRankLadder1782500000000 implements MigrationInterface {
  name = 'FullRankLadder1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const r of NEW_RANKS) {
      await queryRunner.query(
        `ALTER TYPE "public"."team_members_rank_enum" ADD VALUE IF NOT EXISTS '${r}'`,
      );
      await queryRunner.query(
        `ALTER TYPE "recruitment_rank_enum" ADD VALUE IF NOT EXISTS '${r}'`,
      );
    }
  }

  // Postgres no permite quitar valores de un enum de forma sencilla; no-op.
  public async down(): Promise<void> {
    // Irreversible sin recrear los tipos; se deja intencionalmente vacío.
  }
}

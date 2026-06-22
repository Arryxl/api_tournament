import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nombre del torneo configurable (`tournament_name`) y modo de equipos
 * predefinidos (`predefined_teams_mode`) en `tournament_settings`. El primero
 * alimenta título/landing/overlays; el segundo conmuta la inscripción y el
 * reclutamiento al selector de catálogo. Idempotente (IF NOT EXISTS).
 */
export class TournamentNamePresetMode1782350000000 implements MigrationInterface {
  name = 'TournamentNamePresetMode1782350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "tournament_name" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "predefined_teams_mode" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "predefined_teams_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "tournament_name"`,
    );
  }
}

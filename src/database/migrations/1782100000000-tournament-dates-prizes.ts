import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fechas de las fases del torneo (`phase_dates` jsonb) y premios por puesto
 * (`prize_first/second/third` + `prize_note`) en `tournament_settings`.
 * Alimentan la línea de tiempo y la sección de premios de la landing, ahora
 * editables desde el admin. Idempotente (IF NOT EXISTS).
 */
export class TournamentDatesPrizes1782100000000 implements MigrationInterface {
  name = 'TournamentDatesPrizes1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "phase_dates" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "prize_first" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "prize_second" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "prize_third" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "prize_note" character varying(280)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "prize_note"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "prize_third"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "prize_second"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "prize_first"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "phase_dates"`);
  }
}

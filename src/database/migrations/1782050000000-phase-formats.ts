import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Formatos de serie por fase eliminatoria en `tournament_settings`
 * (bo3/bo5/bo7) + valor 'single' en el enum de formato de partido para la
 * fase de grupos (partido único). Idempotente.
 */
export class PhaseFormats1782050000000 implements MigrationInterface {
  name = 'PhaseFormats1782050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 'single' (partido único) para los partidos de la fase de grupos.
    await queryRunner.query(
      `ALTER TYPE "public"."matches_format_enum" ADD VALUE IF NOT EXISTS 'single'`,
    );

    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "format_round16" character varying(10) NOT NULL DEFAULT 'bo3'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "format_quarters" character varying(10) NOT NULL DEFAULT 'bo3'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "format_semis" character varying(10) NOT NULL DEFAULT 'bo5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "format_third" character varying(10) NOT NULL DEFAULT 'bo7'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "format_final" character varying(10) NOT NULL DEFAULT 'bo7'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No se puede quitar un valor de un enum en PostgreSQL; solo las columnas.
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "format_final"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "format_third"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "format_semis"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "format_quarters"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "format_round16"`);
  }
}

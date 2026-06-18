import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Torneo configurable (formato + nº de equipos):
 *  - Columnas `players_per_side` (def. 3) y `substitutes` (def. 2) en
 *    `tournament_settings`.
 *  - Valor 'round16' (octavos) en el enum de fase de partidos, necesario
 *    cuando el torneo es de 32 equipos (8 grupos).
 *
 * Idempotente: ADD COLUMN IF NOT EXISTS + ADD VALUE IF NOT EXISTS, para poder
 * correrla sobre una BD creada en desarrollo con DB_SYNC=true.
 */
export class ConfigurableTournament1781800000000 implements MigrationInterface {
  name = 'ConfigurableTournament1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "players_per_side" integer NOT NULL DEFAULT 3`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "substitutes" integer NOT NULL DEFAULT 2`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "registration_deadline" TIMESTAMP`,
    );

    // Octavos de final. El nombre del enum por defecto de TypeORM es
    // "matches_phase_enum". ADD VALUE IF NOT EXISTS requiere PostgreSQL 12+.
    await queryRunner.query(
      `ALTER TYPE "public"."matches_phase_enum" ADD VALUE IF NOT EXISTS 'round16'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No se puede quitar un valor de un enum en PostgreSQL; solo revertimos
    // las columnas añadidas.
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "registration_deadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "substitutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "players_per_side"`,
    );
  }
}

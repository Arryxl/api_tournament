import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Textos parametrizables del torneo en `tournament_settings`: etiqueta de
 * temporada, plataforma, tagline, entrada gratis/de pago y rango elegible
 * (min/max). Para preparar futuras temporadas sin tocar código. Idempotente.
 */
export class SeasonAndRankConfig1782450000000 implements MigrationInterface {
  name = 'SeasonAndRankConfig1782450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "season_label" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "platform" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "tagline" character varying(280)`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "entry_free" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "min_rank" character varying(20) NOT NULL DEFAULT 'plat3'`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" ADD COLUMN IF NOT EXISTS "max_rank" character varying(20) NOT NULL DEFAULT 'gc1'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "max_rank"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "min_rank"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "entry_free"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "tagline"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "platform"`);
    await queryRunner.query(`ALTER TABLE "tournament_settings" DROP COLUMN IF EXISTS "season_label"`);
  }
}

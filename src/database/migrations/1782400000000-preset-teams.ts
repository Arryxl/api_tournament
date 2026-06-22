import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo editable de equipos predefinidos (`preset_teams`). Reemplaza el
 * array estático en código por una tabla administrable. Se siembra con los 16
 * de la RLCS 2026 vía `npm run seed:presets`. Idempotente.
 */
export class PresetTeams1782400000000 implements MigrationInterface {
  name = 'PresetTeams1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "preset_teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(60) NOT NULL,
        "name" character varying(100) NOT NULL,
        "region" character varying(80),
        "placement_label" character varying(120),
        "logo" character varying(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_preset_teams_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_preset_teams_slug" UNIQUE ("slug")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "preset_teams"`);
  }
}

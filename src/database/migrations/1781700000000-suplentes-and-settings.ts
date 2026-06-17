import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pone el esquema al día con las entidades actuales:
 *  - Tabla `tournament_settings` (estado global del torneo + cupo de equipos).
 *  - Columnas de los 2 suplentes (player4_* y player5_*) en `registration_forms`.
 *
 * Es idempotente (IF NOT EXISTS) para poder correrla sin riesgo sobre una BD
 * que en desarrollo se haya creado con DB_SYNC=true.
 */
export class SuplentesAndSettings1781700000000 implements MigrationInterface {
    name = 'SuplentesAndSettings1781700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- tournament_settings ---
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "tournament_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "registrations_open" boolean NOT NULL DEFAULT true,
                "tournament_started" boolean NOT NULL DEFAULT false,
                "team_capacity" integer NOT NULL DEFAULT 16,
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tournament_settings_id" PRIMARY KEY ("id")
            )
        `);

        // --- suplentes (jugadores 4 y 5) en registration_forms ---
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player4_epic" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player4_steam" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player4_rank" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player4_screenshot" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player5_epic" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player5_steam" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player5_rank" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player5_screenshot" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player5_screenshot"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player5_rank"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player5_steam"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player5_epic"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player4_screenshot"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player4_rank"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player4_steam"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player4_epic"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tournament_settings"`);
    }
}

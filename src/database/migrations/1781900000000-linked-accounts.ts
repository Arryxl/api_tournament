import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla `linked_accounts`: cuentas de plataforma (Steam/Epic) verificadas por
 * OAuth/OpenID y vinculadas a un usuario. El `platform_id` (SteamID64 / Epic
 * Account ID) es el ancla para resolver `replay → jugador → equipo` al cargar
 * estadísticas de partidos privados.
 *
 * Idempotente (IF NOT EXISTS) para poder correrla sobre una BD de desarrollo
 * creada con DB_SYNC=true.
 */
export class LinkedAccounts1781900000000 implements MigrationInterface {
  name = 'LinkedAccounts1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "linked_accounts_platform_enum" AS ENUM ('steam', 'epic');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "linked_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "platform" "linked_accounts_platform_enum" NOT NULL,
        "platform_id" character varying(100) NOT NULL,
        "display_name" character varying(100),
        "verified_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_linked_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_linked_accounts_platform_platform_id" UNIQUE ("platform", "platform_id"),
        CONSTRAINT "UQ_linked_accounts_user_platform" UNIQUE ("user_id", "platform"),
        CONSTRAINT "FK_linked_accounts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "linked_accounts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "linked_accounts_platform_enum"`);
  }
}

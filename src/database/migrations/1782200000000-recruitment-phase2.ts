import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reclutamiento Fase 2:
 *  - `player_profiles`: datos de juego por usuario (fuente única para reclutar).
 *  - `team_drafts` + `team_draft_invites`: creación de equipo nuevo por
 *    invitaciones internas (se materializa al completar los titulares).
 *  - `notifications`: avisos in-app (campana).
 *
 * Reutiliza los tipos enum `recruitment_rank_enum` / `recruitment_position_enum`
 * creados en la Fase 1. Idempotente (IF NOT EXISTS) para BD con DB_SYNC=true.
 * No toca las tablas de la Fase 1.
 */
export class RecruitmentPhase21782200000000 implements MigrationInterface {
  name = 'RecruitmentPhase21782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_draft_status_enum" AS ENUM ('pending', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM
          ('team_invite', 'draft_invite', 'application', 'request_accepted',
           'request_rejected', 'team_created', 'leave_request', 'member_left');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "player_profiles" (
        "user_id" uuid NOT NULL,
        "epic_username" character varying(100),
        "steam_username" character varying(100),
        "rank" "recruitment_rank_enum",
        "screenshot_url" character varying(500),
        "position" "recruitment_position_enum",
        "region" character varying(80),
        "availability" character varying(120),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_player_profiles" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_player_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "captain_id" uuid NOT NULL,
        "team_name" character varying(100) NOT NULL,
        "shield_url" character varying(500),
        "required_starters" integer NOT NULL,
        "max_roster" integer NOT NULL,
        "status" "team_draft_status_enum" NOT NULL DEFAULT 'pending',
        "team_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        CONSTRAINT "PK_team_drafts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_team_drafts_captain" FOREIGN KEY ("captain_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_drafts_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_draft_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "draft_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "request_status_enum" NOT NULL DEFAULT 'pending',
        "accepted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_draft_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_team_draft_invites_draft" FOREIGN KEY ("draft_id")
          REFERENCES "team_drafts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_draft_invites_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" character varying(160) NOT NULL,
        "body" text,
        "link" character varying(200),
        "read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read"
        ON "notifications" ("user_id", "read")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_draft_invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_drafts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "player_profiles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_draft_status_enum"`);
  }
}

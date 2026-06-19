import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo de reclutamiento (LFT / mercado de fichajes):
 *  - `recruitment_posts`: tablón bidireccional (jugadores libres / equipos buscando).
 *  - `join_requests`: solicitudes dirigidas de unión a un equipo (postulación o
 *    invitación), con los datos de inscripción del jugador embebidos.
 *  - `team_leave_requests`: solicitudes de salida de un jugador, que el capitán
 *    aprueba para desvincularlo manteniendo su cuenta activa.
 *
 * Idempotente (IF NOT EXISTS) para poder correrla sobre una BD de desarrollo
 * creada con DB_SYNC=true.
 */
export class Recruitment1782150000000 implements MigrationInterface {
  name = 'Recruitment1782150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "recruitment_type_enum" AS ENUM ('player_lft', 'team_lfp');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "recruitment_status_enum" AS ENUM ('open', 'closed', 'hidden');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "recruitment_position_enum" AS ENUM ('striker', 'goalie', 'flex');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "recruitment_rank_enum" AS ENUM
          ('plat3', 'plat4', 'dia1', 'dia2', 'dia3', 'champ1', 'champ2', 'champ3');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "join_direction_enum" AS ENUM ('player_to_team', 'team_to_player');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "request_status_enum" AS ENUM
          ('pending', 'accepted', 'rejected', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recruitment_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "recruitment_type_enum" NOT NULL,
        "author_id" uuid NOT NULL,
        "status" "recruitment_status_enum" NOT NULL DEFAULT 'open',
        "message" text,
        "region" character varying(80),
        "availability" character varying(120),
        "epic_username" character varying(100),
        "steam_username" character varying(100),
        "rank" "recruitment_rank_enum",
        "screenshot_url" character varying(500),
        "position" "recruitment_position_enum",
        "team_id" uuid,
        "team_name" character varying(100),
        "looking_for_rank" "recruitment_rank_enum",
        "looking_for_position" "recruitment_position_enum",
        "slots_needed" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recruitment_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recruitment_posts_author" FOREIGN KEY ("author_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recruitment_posts_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "join_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "direction" "join_direction_enum" NOT NULL,
        "status" "request_status_enum" NOT NULL DEFAULT 'pending',
        "team_id" uuid NOT NULL,
        "applicant_id" uuid NOT NULL,
        "epic_username" character varying(100),
        "steam_username" character varying(100),
        "rank" "recruitment_rank_enum",
        "screenshot_url" character varying(500),
        "source_post_id" uuid,
        "message" text,
        "resolved_at" TIMESTAMP,
        "resolved_by" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_join_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_join_requests_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_join_requests_applicant" FOREIGN KEY ("applicant_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_join_requests_source_post" FOREIGN KEY ("source_post_id")
          REFERENCES "recruitment_posts"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_leave_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "member_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "request_status_enum" NOT NULL DEFAULT 'pending',
        "reason" text,
        "resolved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_leave_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_team_leave_requests_member" FOREIGN KEY ("member_id")
          REFERENCES "team_members"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_leave_requests_team" FOREIGN KEY ("team_id")
          REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_leave_requests_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_leave_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "join_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_posts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "request_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "join_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recruitment_rank_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recruitment_position_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recruitment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recruitment_type_enum"`);
  }
}

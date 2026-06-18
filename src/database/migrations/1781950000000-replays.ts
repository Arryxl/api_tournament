import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla `replays`: cola de ingesta de archivos `.replay`. Guarda el id de
 * ballchasing, el hash para deduplicar, el estado del match/import, el motivo
 * de revisión y el desglose parseado (`raw_stats`).
 *
 * Idempotente (IF NOT EXISTS).
 */
export class Replays1781950000000 implements MigrationInterface {
  name = 'Replays1781950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "replays_status_enum" AS ENUM ('processing', 'imported', 'needs_review', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "replays" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "match_id" uuid,
        "uploaded_by_id" uuid,
        "ballchasing_id" character varying(100),
        "file_hash" character varying(64) NOT NULL,
        "original_name" character varying(260),
        "status" "replays_status_enum" NOT NULL DEFAULT 'processing',
        "home_score" integer,
        "away_score" integer,
        "review_reason" text,
        "raw_stats" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP,
        CONSTRAINT "PK_replays" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_replays_file_hash" UNIQUE ("file_hash"),
        CONSTRAINT "FK_replays_match" FOREIGN KEY ("match_id")
          REFERENCES "matches"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_replays_uploaded_by" FOREIGN KEY ("uploaded_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "replays"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "replays_status_enum"`);
  }
}

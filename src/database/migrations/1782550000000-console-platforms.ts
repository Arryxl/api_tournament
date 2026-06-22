import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soporte de consolas (PSN / Xbox / Switch) para el tracking de stats:
 *  - amplía el enum de plataformas vinculadas (`linked_accounts_platform_enum`),
 *  - hace `verified_at` nullable (las consolas no se verifican por OAuth),
 *  - añade IDs de consola a `team_members` y `registration_forms` (playerN_*).
 * Idempotente.
 */
export class ConsolePlatforms1782550000000 implements MigrationInterface {
  name = 'ConsolePlatforms1782550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const v of ['psn', 'xbox', 'switch']) {
      await queryRunner.query(
        `ALTER TYPE "public"."linked_accounts_platform_enum" ADD VALUE IF NOT EXISTS '${v}'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "linked_accounts" ALTER COLUMN "verified_at" DROP NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "psn_username" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "xbox_username" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "switch_username" character varying(100)`);

    for (let n = 1; n <= 5; n++) {
      await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player${n}_psn" character varying(100)`);
      await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player${n}_xbox" character varying(100)`);
      await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player${n}_switch" character varying(100)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (let n = 1; n <= 5; n++) {
      await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player${n}_switch"`);
      await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player${n}_xbox"`);
      await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player${n}_psn"`);
    }
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "switch_username"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "xbox_username"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "psn_username"`);
    // El enum no se revierte (Postgres no quita valores de forma sencilla).
  }
}

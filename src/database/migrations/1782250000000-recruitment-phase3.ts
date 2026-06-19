import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reclutamiento Fase 3: un equipo formado por reclutamiento ya NO crea un
 * `Team` directamente, sino que se POSTULA como `RegistrationForm` y pasa por
 * el mismo flujo de aprobación del admin que el registro tradicional.
 *
 *  - `registration_forms`: columnas `playerN_user_id` para enlazar las cuentas
 *    YA EXISTENTES de los jugadores (la aprobación las vincula en vez de crear
 *    credenciales nuevas).
 *  - `team_drafts`: `registration_id` (inscripción generada) + contacto del
 *    capitán para la inscripción.
 *
 * Idempotente (IF NOT EXISTS) para BD con DB_SYNC=true.
 */
export class RecruitmentPhase31782250000000 implements MigrationInterface {
  name = 'RecruitmentPhase31782250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const n of [1, 2, 3, 4, 5]) {
      await queryRunner.query(
        `ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "player${n}_user_id" uuid`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "team_drafts" ADD COLUMN IF NOT EXISTS "registration_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_drafts" ADD COLUMN IF NOT EXISTS "contact_method" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_drafts" ADD COLUMN IF NOT EXISTS "contact_value" character varying(150)`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "team_drafts" ADD CONSTRAINT "FK_team_drafts_registration"
          FOREIGN KEY ("registration_id") REFERENCES "registration_forms"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_drafts" DROP CONSTRAINT IF EXISTS "FK_team_drafts_registration"`,
    );
    await queryRunner.query(`ALTER TABLE "team_drafts" DROP COLUMN IF EXISTS "contact_value"`);
    await queryRunner.query(`ALTER TABLE "team_drafts" DROP COLUMN IF EXISTS "contact_method"`);
    await queryRunner.query(`ALTER TABLE "team_drafts" DROP COLUMN IF EXISTS "registration_id"`);
    for (const n of [1, 2, 3, 4, 5]) {
      await queryRunner.query(
        `ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "player${n}_user_id"`,
      );
    }
  }
}

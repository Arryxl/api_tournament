import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade el rango "Grand Champion 1" (gc1) a los tipos enum de rango.
 * Aplica al rank de `team_members` y al rango usado por el reclutamiento
 * (`recruitment_rank_enum`: recruitment_posts, join_requests, player_profiles).
 *
 * `registration_forms.playerN_rank` es varchar(20), así que no requiere cambios.
 * Regla de negocio (validada en el servicio, no en la BD): máximo 1 gc1 por equipo.
 */
export class RankGc11782300000000 implements MigrationInterface {
  name = 'RankGc11782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."team_members_rank_enum" ADD VALUE IF NOT EXISTS 'gc1'`,
    );
    await queryRunner.query(
      `ALTER TYPE "recruitment_rank_enum" ADD VALUE IF NOT EXISTS 'gc1'`,
    );
  }

  // Postgres no permite quitar valores de un enum de forma sencilla; no-op.
  public async down(): Promise<void> {
    // Irreversible sin recrear los tipos; se deja intencionalmente vacío.
  }
}

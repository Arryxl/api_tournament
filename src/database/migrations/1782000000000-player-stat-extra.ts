import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Columna `extra` (jsonb) en `player_stats` para las métricas avanzadas del
 * replay (boost / movimiento / posicionamiento). Null cuando la stat se cargó
 * a mano sin replay. Idempotente (IF NOT EXISTS).
 */
export class PlayerStatExtra1782000000000 implements MigrationInterface {
  name = 'PlayerStatExtra1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "extra" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_stats" DROP COLUMN IF EXISTS "extra"`,
    );
  }
}

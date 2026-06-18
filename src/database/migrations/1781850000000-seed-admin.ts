import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Crea el usuario superadministrador por defecto.
 *
 *   usuario:    admin
 *   contraseña: admin123   (hash bcrypt embebido abajo)
 *   rol:        admin  (máximo privilegio del sistema)
 *
 * Idempotente: si ya existe un usuario "admin" no hace nada.
 */
export class SeedAdmin1781850000000 implements MigrationInterface {
    name = 'SeedAdmin1781850000000'

    // bcrypt de "admin123" (cost 10)
    private static readonly PASSWORD_HASH =
        '$2b$10$i4/Y0YkfqPgaaTe9N8C.WeT0lcESjgMsByQ7PtvJEBPfdxZkxUHTa';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "users" ("username", "email", "password_hash", "role", "coins", "is_active")
             VALUES ('admin', 'admin@gravity.gg', $1, 'admin', 0, true)
             ON CONFLICT ("username") DO NOTHING`,
            [SeedAdmin1781850000000.PASSWORD_HASH],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "users" WHERE "username" = 'admin'`);
    }
}

import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Medio de contacto del capitán en `registration_forms`: por aquí el admin
 * envía la respuesta de la inscripción y las credenciales de ingreso al torneo
 * (Discord o correo).
 *
 * Idempotente (IF NOT EXISTS) para poder correrla sobre una BD que en
 * desarrollo se haya creado con DB_SYNC=true.
 */
export class ContactMethod1781750000000 implements MigrationInterface {
    name = 'ContactMethod1781750000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "contact_method" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD COLUMN IF NOT EXISTS "contact_value" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "contact_method" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "contact_value" character varying(150)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN IF EXISTS "contact_value"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN IF EXISTS "contact_method"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "contact_value"`);
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP COLUMN IF EXISTS "contact_method"`);
    }
}

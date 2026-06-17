import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1781652714566 implements MigrationInterface {
    name = 'Init1781652714566'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'candidate', 'public')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50) NOT NULL, "email" character varying(100), "password_hash" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'public', "coins" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(10) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."team_members_rank_enum" AS ENUM('plat3', 'plat4', 'dia1', 'dia2', 'dia3', 'champ1', 'champ2', 'champ3')`);
        await queryRunner.query(`CREATE TABLE "team_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "team_id" uuid NOT NULL, "user_id" uuid, "epic_username" character varying(100), "steam_username" character varying(100), "rank" "public"."team_members_rank_enum", "screenshot_url" character varying(500), "is_captain" boolean NOT NULL DEFAULT false, "player_number" integer NOT NULL, CONSTRAINT "UQ_1c929b952bf57e6e3bcac9fd379" UNIQUE ("team_id", "player_number"), CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."teams_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "shield_url" character varying(500), "captain_id" uuid, "group_id" uuid, "status" "public"."teams_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_48c0c32e6247a2de155baeaf980" UNIQUE ("name"), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "group_standings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "team_id" uuid NOT NULL, "played" integer NOT NULL DEFAULT '0', "won" integer NOT NULL DEFAULT '0', "drawn" integer NOT NULL DEFAULT '0', "lost" integer NOT NULL DEFAULT '0', "goals_for" integer NOT NULL DEFAULT '0', "goals_against" integer NOT NULL DEFAULT '0', "points" integer NOT NULL DEFAULT '0', "position" integer, CONSTRAINT "PK_80d3b544cb0d28fbc252df1777c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."matches_phase_enum" AS ENUM('groups', 'quarters', 'semis', 'third', 'final')`);
        await queryRunner.query(`CREATE TYPE "public"."matches_status_enum" AS ENUM('scheduled', 'live', 'finished')`);
        await queryRunner.query(`CREATE TYPE "public"."matches_format_enum" AS ENUM('bo3', 'bo5', 'bo7')`);
        await queryRunner.query(`CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "match_code" character varying(10) NOT NULL, "phase" "public"."matches_phase_enum" NOT NULL, "team_home_id" uuid, "team_away_id" uuid, "home_score" integer, "away_score" integer, "winner_id" uuid, "scheduled_at" TIMESTAMP, "played_at" TIMESTAMP, "status" "public"."matches_status_enum" NOT NULL DEFAULT 'scheduled', "format" "public"."matches_format_enum" NOT NULL, "group_id" uuid, "round_number" integer, "predictions_open" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_a482b756881288b487819aeab1f" UNIQUE ("match_code"), CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "player_stats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "match_id" uuid NOT NULL, "user_id" uuid NOT NULL, "team_id" uuid NOT NULL, "goals" integer NOT NULL DEFAULT '0', "assists" integer NOT NULL DEFAULT '0', "saves" integer NOT NULL DEFAULT '0', "score" integer NOT NULL DEFAULT '0', "shots" integer NOT NULL DEFAULT '0', "demos" integer NOT NULL DEFAULT '0', "mvp" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f91ebfcfb53d3e527493387a1cc" UNIQUE ("match_id", "user_id"), CONSTRAINT "PK_22e2d8ec820a98efbfdbf84d925" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "predictions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "match_id" uuid NOT NULL, "predicted_winner_id" uuid, "predicted_home_score" integer, "predicted_away_score" integer, "is_correct" boolean, "coins_earned" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_aaac60696c99e9f901efa9ffc10" UNIQUE ("user_id", "match_id"), CONSTRAINT "PK_b92c9e4db595214b289f5e28adc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "prediction_windows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "match_id" uuid NOT NULL, "open_from" TIMESTAMP NOT NULL, "open_until" TIMESTAMP NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, CONSTRAINT "PK_2432ff635e7b690f15b6c2cd886" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."coin_transactions_transaction_type_enum" AS ENUM('earned', 'spent', 'admin_grant')`);
        await queryRunner.query(`CREATE TABLE "coin_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "amount" integer NOT NULL, "concept" character varying(200) NOT NULL, "transaction_type" "public"."coin_transactions_transaction_type_enum" NOT NULL, "match_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7dad7cc20e8e6f4700b04928e12" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rewards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, "image_url" character varying(500), "cost_coins" integer NOT NULL, "stock" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3d947441a48debeb9b7366f8b8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reward_redemptions_status_enum" AS ENUM('pending', 'delivered', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "reward_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "reward_id" uuid NOT NULL, "status" "public"."reward_redemptions_status_enum" NOT NULL DEFAULT 'pending', "redeemed_at" TIMESTAMP NOT NULL DEFAULT now(), "notes" text, CONSTRAINT "PK_e02d178fa8c54295d8edc8781b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."registration_forms_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "registration_forms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "team_name" character varying(100) NOT NULL, "shield_url" character varying(500), "player1_epic" character varying(100), "player1_steam" character varying(100), "player1_rank" character varying(20), "player1_screenshot" character varying(500), "player2_epic" character varying(100), "player2_steam" character varying(100), "player2_rank" character varying(20), "player2_screenshot" character varying(500), "player3_epic" character varying(100), "player3_steam" character varying(100), "player3_rank" character varying(20), "player3_screenshot" character varying(500), "captain_player" integer, "status" "public"."registration_forms_status_enum" NOT NULL DEFAULT 'pending', "rejection_reason" text, "submitted_at" TIMESTAMP NOT NULL DEFAULT now(), "reviewed_at" TIMESTAMP, "reviewed_by" uuid, CONSTRAINT "PK_bbefd7d76d4099a99d2d0172098" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_efa32c8850c6857db07943ae07d" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_dac3c13839536151455938e66b7" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_standings" ADD CONSTRAINT "FK_355d74cdcc7c382ae3373d15f81" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_standings" ADD CONSTRAINT "FK_eba8e7869272f6e1f6515676cd7" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_3fe32e03fb9dd08fd9b1dcc8616" FOREIGN KEY ("team_home_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_842504e0e192b2970afa17eb880" FOREIGN KEY ("team_away_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_24e8071e3486275a5a31912a87d" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "player_stats" ADD CONSTRAINT "FK_be4dd77b5023f74bf3d5d4bfd7a" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "player_stats" ADD CONSTRAINT "FK_f6d777852a4a0e0416afbcdf6a5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "player_stats" ADD CONSTRAINT "FK_f938620176d72eb9fe45db190a3" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "predictions" ADD CONSTRAINT "FK_8e4b27973471685734e213da971" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "predictions" ADD CONSTRAINT "FK_bf038b973af03c3568dffd9df69" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "predictions" ADD CONSTRAINT "FK_3f5137a1146e966c1af83be284f" FOREIGN KEY ("predicted_winner_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prediction_windows" ADD CONSTRAINT "FK_92e59f01d0b10c8e176735d20f7" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prediction_windows" ADD CONSTRAINT "FK_9db0208af1dd00315381c0d3213" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coin_transactions" ADD CONSTRAINT "FK_e85b0a5bf336ec85a9c84c1c391" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coin_transactions" ADD CONSTRAINT "FK_79d9cc2b8c7cc3513da5f8e2fb2" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" ADD CONSTRAINT "FK_8e40cc924716518bc5d1828ce3d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" ADD CONSTRAINT "FK_6b13532c084052b9d0a749f8edb" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registration_forms" ADD CONSTRAINT "FK_bccba8e6133ec0f266a35741a4a" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registration_forms" DROP CONSTRAINT "FK_bccba8e6133ec0f266a35741a4a"`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" DROP CONSTRAINT "FK_6b13532c084052b9d0a749f8edb"`);
        await queryRunner.query(`ALTER TABLE "reward_redemptions" DROP CONSTRAINT "FK_8e40cc924716518bc5d1828ce3d"`);
        await queryRunner.query(`ALTER TABLE "coin_transactions" DROP CONSTRAINT "FK_79d9cc2b8c7cc3513da5f8e2fb2"`);
        await queryRunner.query(`ALTER TABLE "coin_transactions" DROP CONSTRAINT "FK_e85b0a5bf336ec85a9c84c1c391"`);
        await queryRunner.query(`ALTER TABLE "prediction_windows" DROP CONSTRAINT "FK_9db0208af1dd00315381c0d3213"`);
        await queryRunner.query(`ALTER TABLE "prediction_windows" DROP CONSTRAINT "FK_92e59f01d0b10c8e176735d20f7"`);
        await queryRunner.query(`ALTER TABLE "predictions" DROP CONSTRAINT "FK_3f5137a1146e966c1af83be284f"`);
        await queryRunner.query(`ALTER TABLE "predictions" DROP CONSTRAINT "FK_bf038b973af03c3568dffd9df69"`);
        await queryRunner.query(`ALTER TABLE "predictions" DROP CONSTRAINT "FK_8e4b27973471685734e213da971"`);
        await queryRunner.query(`ALTER TABLE "player_stats" DROP CONSTRAINT "FK_f938620176d72eb9fe45db190a3"`);
        await queryRunner.query(`ALTER TABLE "player_stats" DROP CONSTRAINT "FK_f6d777852a4a0e0416afbcdf6a5"`);
        await queryRunner.query(`ALTER TABLE "player_stats" DROP CONSTRAINT "FK_be4dd77b5023f74bf3d5d4bfd7a"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_24e8071e3486275a5a31912a87d"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_842504e0e192b2970afa17eb880"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_3fe32e03fb9dd08fd9b1dcc8616"`);
        await queryRunner.query(`ALTER TABLE "group_standings" DROP CONSTRAINT "FK_eba8e7869272f6e1f6515676cd7"`);
        await queryRunner.query(`ALTER TABLE "group_standings" DROP CONSTRAINT "FK_355d74cdcc7c382ae3373d15f81"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_dac3c13839536151455938e66b7"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_efa32c8850c6857db07943ae07d"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_c2bf4967c8c2a6b845dadfbf3d4"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea"`);
        await queryRunner.query(`DROP TABLE "registration_forms"`);
        await queryRunner.query(`DROP TYPE "public"."registration_forms_status_enum"`);
        await queryRunner.query(`DROP TABLE "reward_redemptions"`);
        await queryRunner.query(`DROP TYPE "public"."reward_redemptions_status_enum"`);
        await queryRunner.query(`DROP TABLE "rewards"`);
        await queryRunner.query(`DROP TABLE "coin_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."coin_transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TABLE "prediction_windows"`);
        await queryRunner.query(`DROP TABLE "predictions"`);
        await queryRunner.query(`DROP TABLE "player_stats"`);
        await queryRunner.query(`DROP TABLE "matches"`);
        await queryRunner.query(`DROP TYPE "public"."matches_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."matches_phase_enum"`);
        await queryRunner.query(`DROP TABLE "group_standings"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP TYPE "public"."teams_status_enum"`);
        await queryRunner.query(`DROP TABLE "team_members"`);
        await queryRunner.query(`DROP TYPE "public"."team_members_rank_enum"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}

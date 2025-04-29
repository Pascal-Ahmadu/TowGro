import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1719696000000 implements MigrationInterface {
    name = 'InitialSchema1719696000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the UUID extension if it doesn't exist
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Create User table
        await queryRunner.query(`
            CREATE TABLE "user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(255),
                "phoneNumber" character varying,
                "password" character varying NOT NULL,
                "isActive" boolean NOT NULL DEFAULT false,
                "roles" text NOT NULL DEFAULT 'user',
                "biometricMethods" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "dateOfBirth" TIMESTAMP,
                "governmentId" character varying,
                "driverLicense" character varying,
                "emailVerified" boolean NOT NULL DEFAULT false,
                "twoFactorSecret" character varying,
                "tempTwoFactorSecret" character varying,
                "twoFactorEnabled" boolean NOT NULL DEFAULT false,
                "avatarUrl" character varying,
                "preferences" json,
                CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
                CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e1f623798118e629b46a9e629" ON "user" ("phoneNumber") `);

        // Create vehicles table
        await queryRunner.query(`
            CREATE TABLE "vehicles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "make" character varying NOT NULL,
                "model" character varying NOT NULL,
                "year" integer NOT NULL,
                "color" character varying NOT NULL,
                "plateNumber" character varying NOT NULL,
                "registrationNumber" character varying NOT NULL,
                "description" character varying,
                "isActive" boolean NOT NULL DEFAULT true,
                "type" character varying NOT NULL DEFAULT 'tow',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD CONSTRAINT "FK_20f139b9d79f917ef735efacb00" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Create vehicle_locations table
        await queryRunner.query(`
            CREATE TABLE "vehicle_locations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "vehicleId" uuid NOT NULL,
                "dispatchId" uuid NOT NULL,
                "latitude" numeric(10,7) NOT NULL,
                "longitude" numeric(10,7) NOT NULL,
                "speed" numeric(5,2) NOT NULL DEFAULT '0',
                "bearing" numeric(5,2) NOT NULL DEFAULT '0',
                "distanceTraveled" numeric(10,5) NOT NULL DEFAULT '0',
                "registrationNumber" character varying,
                "plateNumber" character varying,
                "vehicleColor" character varying,
                "vehicleMake" character varying,
                "vehicleDescription" character varying,
                "timestamp" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_461bc8a748fd993c903a5c70627" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_7dfd50c93e9273155348a2b7d0" ON "vehicle_locations" ("vehicleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3bdf3abdcf8e4eb7a9de160c7e" ON "vehicle_locations" ("dispatchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8decd8f76a3c5cb1ecd3328e9a" ON "vehicle_locations" ("timestamp") `);

        // Create payment_method table
        await queryRunner.query(`
            CREATE TABLE "payment_method" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "lastFour" character varying NOT NULL,
                "brand" character varying NOT NULL,
                "encryptedData" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                CONSTRAINT "PK_7661bee59a8a41e2ac58684b1c8" PRIMARY KEY ("id")
            )
        `);

        // Create transactions table
        await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "reference" character varying NOT NULL,
                "customerEmail" character varying NOT NULL,
                "amount" integer NOT NULL,
                "currency" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "metadata" json,
                "ipAddress" character varying,
                "userAgent" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_9e8965d4dbb68f697f8ddd6421b" UNIQUE ("reference"),
                CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_9e8965d4dbb68f697f8ddd6421" ON "transactions" ("reference") `);
        await queryRunner.query(`CREATE INDEX "IDX_7197c322ccdd31b5c66819f0b6" ON "transactions" ("customerEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_abf1f886dfbd2562badbd18c9d" ON "transactions" ("status") `);

        // Create notifications table
        await queryRunner.query(`
            CREATE TYPE "public"."notification_type_enum" AS ENUM('SYSTEM', 'PAYMENT', 'DISPATCH', 'USER', 'VEHICLE')
        `);
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "type" "public"."notification_type_enum" NOT NULL,
                "content" character varying NOT NULL,
                "metadata" json NOT NULL DEFAULT '{}',
                "read" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "readAt" TIMESTAMP,
                CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
            )
        `);

        // Create dispatch table
        await queryRunner.query(`
            CREATE TYPE "public"."dispatch_status_enum" AS ENUM('pending', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled', 'payment_pending', 'payment_completed', 'failed')
        `);
        await queryRunner.query(`
            CREATE TABLE "dispatch" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "pickupLat" numeric NOT NULL,
                "pickupLng" numeric NOT NULL,
                "status" "public"."dispatch_status_enum" NOT NULL DEFAULT 'pending',
                "paymentReference" character varying,
                "paymentUrl" character varying,
                "paymentAmount" numeric(10,2),
                "paymentInitiatedAt" TIMESTAMP,
                "paymentVerifiedAt" TIMESTAMP,
                CONSTRAINT "PK_9a3f2c083d9bdd3c19639b9b05c" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`ALTER TABLE "dispatch" ADD CONSTRAINT "FK_838623fbcc1566e12ab28b803fc" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Create audit_logs table
        await queryRunner.query(`
            CREATE TYPE "public"."audit_action_enum" AS ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PAYMENT', 'DISPATCH')
        `);
        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "action" "public"."audit_action_enum" NOT NULL,
                "resource" character varying NOT NULL,
                "resourceId" character varying,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "ipAddress" character varying,
                "timestamp" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5b769d8aa69539c2b3ef77b78bd" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_69429d0a6a4df0d1cf9e8c8855" ON "audit_logs" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_62a29a7ceb55ade7c30bacda5a" ON "audit_logs" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_8839d6e319694a25e731f26328" ON "audit_logs" ("resource") `);
        await queryRunner.query(`CREATE INDEX "IDX_82ab4c7a4240ba7f9d384b3bad" ON "audit_logs" ("resourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d556f9a8ba1db373989c1eff36" ON "audit_logs" ("timestamp") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop all the constraints first
        await queryRunner.query(`ALTER TABLE "dispatch" DROP CONSTRAINT "FK_838623fbcc1566e12ab28b803fc"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP CONSTRAINT "FK_20f139b9d79f917ef735efacb00"`);

        // Drop all the indices
        await queryRunner.query(`DROP INDEX "public"."IDX_d556f9a8ba1db373989c1eff36"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82ab4c7a4240ba7f9d384b3bad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8839d6e319694a25e731f26328"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62a29a7ceb55ade7c30bacda5a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69429d0a6a4df0d1cf9e8c8855"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_abf1f886dfbd2562badbd18c9d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7197c322ccdd31b5c66819f0b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e8965d4dbb68f697f8ddd6421"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8decd8f76a3c5cb1ecd3328e9a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bdf3abdcf8e4eb7a9de160c7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7dfd50c93e9273155348a2b7d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e1f623798118e629b46a9e629"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e12875dfb3b1d92d7d7c5377e2"`);

        // Drop all the tables
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_action_enum"`);
        await queryRunner.query(`DROP TABLE "dispatch"`);
        await queryRunner.query(`DROP TYPE "public"."dispatch_status_enum"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TABLE "payment_method"`);
        await queryRunner.query(`DROP TABLE "vehicle_locations"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }
}
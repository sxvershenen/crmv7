import type { MigrationInterface, QueryRunner } from "typeorm"

export class UserInvitations1788206400000 implements MigrationInterface {
  name = "UserInvitations1788206400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE user_invitations (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL UNIQUE REFERENCES users(id),
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid NOT NULL REFERENCES users(id),
      CONSTRAINT user_invitations_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$')
    )`)
    await queryRunner.query(`CREATE INDEX user_invitations_expires_at_idx ON user_invitations(expires_at)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE user_invitations`)
  }
}

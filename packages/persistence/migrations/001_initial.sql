-- OpenLearn durable state schema, migration 001.
-- Run this through the migration runner; never run it from application startup.

CREATE TABLE IF NOT EXISTS openlearn_plans (
  plan_id text PRIMARY KEY,
  owner_id text NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('active', 'deleted')),
  current_revision_id text,
  current_revision_number integer,
  accepted_at timestamptz,
  aggregate jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  CHECK (
    (lifecycle = 'active' AND current_revision_id IS NOT NULL AND current_revision_number IS NOT NULL AND accepted_at IS NOT NULL AND deleted_at IS NULL)
    OR
    (lifecycle = 'deleted' AND current_revision_id IS NULL AND current_revision_number IS NULL AND accepted_at IS NULL AND deleted_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS openlearn_plans_owner_active_idx
  ON openlearn_plans (owner_id, updated_at DESC)
  WHERE lifecycle = 'active';

CREATE TABLE IF NOT EXISTS openlearn_operations (
  operation_id text PRIMARY KEY,
  kind text NOT NULL,
  owner_id text NOT NULL,
  capability text NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
  request_fingerprint text NOT NULL CHECK (char_length(request_fingerprint) BETWEEN 1 AND 256),
  state text NOT NULL CHECK (state IN ('received', 'in_progress', 'reconciling', 'succeeded', 'rejected', 'failed_retryable', 'cancelled', 'expired', 'conflict')),
  started_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  fencing_version integer NOT NULL CHECK (fencing_version >= 0),
  outcome jsonb,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS openlearn_operations_dedup_idx
  ON openlearn_operations (owner_id, capability, idempotency_key);

CREATE INDEX IF NOT EXISTS openlearn_operations_recovery_idx
  ON openlearn_operations (lease_expires_at)
  WHERE state IN ('received', 'in_progress', 'reconciling');

CREATE TABLE IF NOT EXISTS openlearn_mutation_markers (
  operation_id text PRIMARY KEY,
  operation_kind text NOT NULL,
  owner_id text NOT NULL,
  capability text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  outcome jsonb NOT NULL,
  plan_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES openlearn_plans (plan_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS openlearn_mutation_markers_dedup_idx
  ON openlearn_mutation_markers (owner_id, capability, idempotency_key);

CREATE INDEX IF NOT EXISTS openlearn_mutation_markers_expiry_idx
  ON openlearn_mutation_markers (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS openlearn_plan_tombstones (
  plan_id text PRIMARY KEY,
  owner_id text NOT NULL,
  deleted_at timestamptz NOT NULL,
  terminal_revision jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS openlearn_personalization (
  owner_id text NOT NULL,
  plan_id text NOT NULL,
  state_version integer NOT NULL CHECK (state_version >= 0),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, plan_id),
  FOREIGN KEY (plan_id) REFERENCES openlearn_plans (plan_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS openlearn_identity_principals (
  issuer text NOT NULL,
  subject text NOT NULL,
  owner_id text NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (issuer, subject),
  UNIQUE (owner_id)
);

CREATE TABLE IF NOT EXISTS openlearn_account_tombstones (
  owner_id text PRIMARY KEY,
  deleted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Migration 0007: Idempotency keys table and query performance indexes
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  UNIQUE (institution_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idempotency_tenant_key ON idempotency_keys(institution_id, idempotency_key);
CREATE INDEX IF NOT EXISTS teachers_tenant_created ON teachers(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS teachers_tenant_phone ON teachers(institution_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS teachers_tenant_phone_unique ON teachers(institution_id, phone) WHERE phone IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS teacher_assignments_tenant_teacher ON teacher_assignments(institution_id, teacher_id, status);
CREATE INDEX IF NOT EXISTS enrollments_tenant_class_active ON enrollments(institution_id, class_id) WHERE status = 'active';

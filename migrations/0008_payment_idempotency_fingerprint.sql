ALTER TABLE idempotency_keys ADD COLUMN actor_membership_id TEXT;
ALTER TABLE idempotency_keys ADD COLUMN request_hash TEXT;

CREATE INDEX idempotency_payment_actor
  ON idempotency_keys(institution_id, actor_membership_id, endpoint, expires_at);

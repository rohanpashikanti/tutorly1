-- Refines financial invariants without rewriting existing payment records.
DROP TRIGGER IF EXISTS allocation_not_over_payment;
DROP TRIGGER IF EXISTS allocation_not_over_charge;
DROP TRIGGER IF EXISTS payments_are_not_deleted;
DROP TRIGGER IF EXISTS payments_identity_is_immutable;
DROP TRIGGER IF EXISTS payments_status_audit;
DROP TRIGGER IF EXISTS payment_allocations_are_immutable_update;
DROP TRIGGER IF EXISTS payment_allocations_are_immutable_delete;

CREATE TRIGGER allocation_not_over_payment
BEFORE INSERT ON payment_allocations
WHEN NOT EXISTS (
       SELECT 1 FROM payments WHERE institution_id = NEW.institution_id AND id = NEW.payment_id AND status = 'received'
     )
  OR (SELECT COALESCE(SUM(amount_paise), 0) FROM payment_allocations WHERE payment_id = NEW.payment_id) + NEW.amount_paise >
     COALESCE((SELECT amount_paise FROM payments WHERE institution_id = NEW.institution_id AND id = NEW.payment_id AND status = 'received'), -1)
BEGIN
  SELECT RAISE(ABORT, 'payment allocation exceeds received payment amount');
END;

CREATE TRIGGER allocation_not_over_charge
BEFORE INSERT ON payment_allocations
WHEN NOT EXISTS (
       SELECT 1 FROM fee_charges WHERE institution_id = NEW.institution_id AND id = NEW.charge_id AND status NOT IN ('waived', 'void')
     )
  OR (SELECT COALESCE(SUM(amount_paise), 0) FROM payment_allocations WHERE charge_id = NEW.charge_id) + NEW.amount_paise >
     COALESCE((SELECT amount_paise FROM fee_charges WHERE institution_id = NEW.institution_id AND id = NEW.charge_id AND status NOT IN ('waived', 'void')), -1)
BEGIN
  SELECT RAISE(ABORT, 'payment allocation exceeds charge amount');
END;

CREATE TRIGGER payments_are_not_deleted
BEFORE DELETE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payment history cannot be deleted');
END;

CREATE TRIGGER payments_identity_is_immutable
BEFORE UPDATE ON payments
WHEN NEW.institution_id != OLD.institution_id
  OR NEW.student_id != OLD.student_id
  OR NEW.amount_paise != OLD.amount_paise
  OR NEW.currency_code != OLD.currency_code
  OR NEW.method != OLD.method
  OR COALESCE(NEW.external_reference, '') != COALESCE(OLD.external_reference, '')
  OR NEW.receipt_no != OLD.receipt_no
  OR NEW.received_at != OLD.received_at
  OR COALESCE(NEW.recorded_by_membership_id, '') != COALESCE(OLD.recorded_by_membership_id, '')
  OR COALESCE(NEW.reverses_payment_id, '') != COALESCE(OLD.reverses_payment_id, '')
  OR COALESCE(NEW.notes, '') != COALESCE(OLD.notes, '')
BEGIN
  SELECT RAISE(ABORT, 'payment identity and amount cannot be changed');
END;

CREATE TRIGGER allocated_payment_status_requires_reversal
BEFORE UPDATE OF status ON payments
WHEN NEW.status != 'received'
  AND EXISTS (SELECT 1 FROM payment_allocations WHERE payment_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'allocated payments must be corrected with a separate reversal record');
END;

CREATE TRIGGER payments_recorded_audit
AFTER INSERT ON payments
BEGIN
  INSERT INTO audit_events (id, institution_id, actor_membership_id, action, entity_type, entity_id, metadata_json)
  VALUES (
    lower(hex(randomblob(16))), NEW.institution_id, NEW.recorded_by_membership_id,
    'payment.recorded', 'payment', NEW.id,
    json_object('amount_paise', NEW.amount_paise, 'status', NEW.status, 'receipt_no', NEW.receipt_no)
  );
END;

CREATE TRIGGER payments_status_audit
AFTER UPDATE OF status ON payments
WHEN NEW.status != OLD.status
BEGIN
  INSERT INTO audit_events (id, institution_id, actor_membership_id, action, entity_type, entity_id, metadata_json)
  VALUES (
    lower(hex(randomblob(16))), NEW.institution_id, NEW.recorded_by_membership_id,
    'payment.status_changed', 'payment', NEW.id,
    json_object('from', OLD.status, 'to', NEW.status, 'receipt_no', NEW.receipt_no)
  );
END;

CREATE TRIGGER payment_allocations_are_immutable_update
BEFORE UPDATE ON payment_allocations
BEGIN
  SELECT RAISE(ABORT, 'payment allocations cannot be changed');
END;

CREATE TRIGGER payment_allocations_are_immutable_delete
BEFORE DELETE ON payment_allocations
BEGIN
  SELECT RAISE(ABORT, 'payment allocations cannot be deleted');
END;

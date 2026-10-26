PRAGMA foreign_keys = ON;

CREATE TABLE fee_plans (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('tuition_fee', 'special_batch', 'subject_wise', 'entrance_prep', 'other')),
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise >= 0),
  currency_code TEXT NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'one_time')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (institution_id, name),
  UNIQUE (institution_id, id)
);
CREATE INDEX fee_plans_tenant_status ON fee_plans(institution_id, status, name, id);

CREATE TABLE student_fee_assignments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL,
  enrollment_id TEXT,
  fee_plan_id TEXT,
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 180),
  agreed_amount_paise INTEGER NOT NULL CHECK (typeof(agreed_amount_paise) = 'integer' AND agreed_amount_paise >= 0),
  discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (typeof(discount_paise) = 'integer' AND discount_paise >= 0 AND discount_paise <= agreed_amount_paise),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, student_id) REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, enrollment_id) REFERENCES enrollments(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, fee_plan_id) REFERENCES fee_plans(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE (institution_id, id)
);
CREATE INDEX fee_assignments_student_status ON student_fee_assignments(institution_id, student_id, status, starts_on DESC, id);

CREATE TABLE fee_charges (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL,
  enrollment_id TEXT,
  assignment_id TEXT,
  installment_no INTEGER CHECK (installment_no IS NULL OR installment_no > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 180),
  period_start TEXT,
  period_end TEXT,
  due_on TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'waived', 'void')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_membership_id TEXT,
  FOREIGN KEY (institution_id, student_id) REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, enrollment_id) REFERENCES enrollments(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, assignment_id) REFERENCES student_fee_assignments(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, created_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  UNIQUE (institution_id, assignment_id, period_start, installment_no),
  UNIQUE (institution_id, id),
  UNIQUE (institution_id, id, student_id)
);
CREATE INDEX fee_charges_due_list ON fee_charges(institution_id, status, due_on, id);
CREATE INDEX fee_charges_student_history ON fee_charges(institution_id, student_id, due_on DESC, id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise > 0),
  currency_code TEXT NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  method TEXT NOT NULL CHECK (method IN ('upi', 'cash', 'card', 'bank_transfer', 'other')),
  external_reference TEXT,
  receipt_no TEXT NOT NULL CHECK (length(trim(receipt_no)) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pending', 'received', 'failed', 'void', 'refunded')),
  received_at TEXT NOT NULL,
  recorded_by_membership_id TEXT,
  reverses_payment_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, student_id) REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, recorded_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, reverses_payment_id) REFERENCES payments(institution_id, id) ON DELETE RESTRICT,
  UNIQUE (institution_id, receipt_no),
  UNIQUE (institution_id, id),
  UNIQUE (institution_id, id, student_id)
);
CREATE UNIQUE INDEX payments_external_reference ON payments(institution_id, external_reference)
  WHERE external_reference IS NOT NULL;
CREATE INDEX payments_student_history ON payments(institution_id, student_id, received_at DESC, id);
CREATE INDEX payments_tenant_history ON payments(institution_id, received_at DESC, id);

CREATE TABLE payment_allocations (
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  payment_id TEXT NOT NULL,
  charge_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (payment_id, charge_id),
  FOREIGN KEY (institution_id, payment_id, student_id) REFERENCES payments(institution_id, id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, charge_id, student_id) REFERENCES fee_charges(institution_id, id, student_id) ON DELETE RESTRICT
);
CREATE INDEX payment_allocations_charge ON payment_allocations(institution_id, charge_id, payment_id);

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

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  author_membership_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  audience TEXT NOT NULL CHECK (audience IN ('all', 'teachers', 'parents')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'medium', 'high', 'urgent')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, author_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at >= published_at),
  UNIQUE (institution_id, id)
);
CREATE INDEX announcements_audience_feed ON announcements(institution_id, status, audience, published_at DESC, id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  actor_membership_id TEXT,
  action TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 100),
  entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 100),
  entity_id TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  FOREIGN KEY (institution_id, actor_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT
);
CREATE INDEX audit_events_tenant_time ON audit_events(institution_id, occurred_at DESC, id);
CREATE INDEX audit_events_entity ON audit_events(institution_id, entity_type, entity_id, occurred_at DESC);

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

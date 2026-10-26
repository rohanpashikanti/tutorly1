PRAGMA foreign_keys = ON;

CREATE TABLE institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  email TEXT,
  phone TEXT,
  address TEXT,
  currency_code TEXT NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (id)
);

-- References identities managed by a future, reviewed auth provider integration.
-- This is not an auth/session/password table and does not authenticate requests.
CREATE TABLE user_refs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (length(trim(provider)) > 0),
  provider_subject TEXT NOT NULL CHECK (length(trim(provider_subject)) > 0),
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (provider, provider_subject),
  UNIQUE (id)
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  user_ref_id TEXT NOT NULL REFERENCES user_refs(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'teacher', 'parent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'ended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (institution_id, user_ref_id),
  UNIQUE (institution_id, id)
);
CREATE INDEX memberships_user_status ON memberships(user_ref_id, status, institution_id);

CREATE TABLE institution_settings (
  institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE RESTRICT,
  short_name TEXT,
  tagline TEXT,
  description TEXT,
  website TEXT,
  academic_year_label TEXT,
  academic_start_date TEXT,
  academic_end_date TEXT,
  default_start_time TEXT,
  default_end_time TEXT,
  working_days_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(working_days_json)),
  passing_percentage REAL NOT NULL DEFAULT 40 CHECK (passing_percentage BETWEEN 0 AND 100),
  attendance_threshold REAL NOT NULL DEFAULT 75 CHECK (attendance_threshold BETWEEN 0 AND 100),
  term_count INTEGER NOT NULL DEFAULT 2 CHECK (term_count BETWEEN 1 AND 12),
  fee_receipt_prefix TEXT,
  default_due_days INTEGER NOT NULL DEFAULT 10 CHECK (default_due_days >= 0),
  allow_partial_payments INTEGER NOT NULL DEFAULT 1 CHECK (allow_partial_payments IN (0, 1)),
  attendance_alerts INTEGER NOT NULL DEFAULT 1 CHECK (attendance_alerts IN (0, 1)),
  test_result_alerts INTEGER NOT NULL DEFAULT 1 CHECK (test_result_alerts IN (0, 1)),
  fee_reminders INTEGER NOT NULL DEFAULT 1 CHECK (fee_reminders IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

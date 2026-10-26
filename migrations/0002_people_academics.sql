PRAGMA foreign_keys = ON;

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  admission_no TEXT NOT NULL CHECK (length(trim(admission_no)) BETWEEN 1 AND 64),
  roll_no TEXT,
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 100),
  last_name TEXT,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  date_of_birth TEXT,
  admission_date TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'needs_attention', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (institution_id, admission_no),
  UNIQUE (institution_id, id)
);
CREATE INDEX students_tenant_status_name ON students(institution_id, status, last_name, first_name, id);
CREATE INDEX students_tenant_created ON students(institution_id, created_at DESC, id DESC);

CREATE TABLE guardians (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  membership_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  UNIQUE (institution_id, membership_id),
  UNIQUE (institution_id, id)
);
CREATE INDEX guardians_tenant_name ON guardians(institution_id, name, id);

CREATE TABLE student_guardians (
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  portal_access INTEGER NOT NULL DEFAULT 0 CHECK (portal_access IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (student_id, guardian_id),
  FOREIGN KEY (institution_id, student_id) REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, guardian_id) REFERENCES guardians(institution_id, id) ON DELETE RESTRICT
);
CREATE INDEX student_guardians_by_guardian ON student_guardians(institution_id, guardian_id, student_id);
CREATE INDEX student_guardians_primary ON student_guardians(institution_id, student_id, is_primary);

CREATE TABLE teachers (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  membership_id TEXT NOT NULL,
  teacher_code TEXT NOT NULL CHECK (length(trim(teacher_code)) BETWEEN 1 AND 64),
  designation TEXT,
  phone TEXT,
  date_of_birth TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  address TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  UNIQUE (institution_id, membership_id),
  UNIQUE (institution_id, teacher_code),
  UNIQUE (institution_id, id)
);
CREATE INDEX teachers_tenant_status ON teachers(institution_id, status, id);

CREATE TABLE academic_years (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (ends_on >= starts_on),
  UNIQUE (institution_id, name),
  UNIQUE (institution_id, id)
);
CREATE UNIQUE INDEX one_active_academic_year_per_institution
  ON academic_years(institution_id) WHERE status = 'active';

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (institution_id, name),
  UNIQUE (institution_id, code),
  UNIQUE (institution_id, id)
);
CREATE INDEX classes_tenant_status ON classes(institution_id, status, name, id);

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  starts_at TEXT,
  ends_at TEXT,
  meeting_days_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(meeting_days_json)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  UNIQUE (institution_id, class_id, name),
  UNIQUE (institution_id, id)
);
CREATE INDEX batches_tenant_class_status ON batches(institution_id, class_id, status, name, id);

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  code TEXT,
  is_core INTEGER NOT NULL DEFAULT 1 CHECK (is_core IN (0, 1)),
  color TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (institution_id, name),
  UNIQUE (institution_id, code),
  UNIQUE (institution_id, id)
);
CREATE INDEX subjects_tenant_status ON subjects(institution_id, status, name, id);

CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  batch_id TEXT,
  roll_no TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, student_id) REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, academic_year_id) REFERENCES academic_years(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, batch_id) REFERENCES batches(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE (institution_id, id),
  UNIQUE (institution_id, id, student_id)
);
CREATE UNIQUE INDEX one_active_enrollment_per_year
  ON enrollments(institution_id, student_id, academic_year_id) WHERE status = 'active';
CREATE UNIQUE INDEX enrollment_roll_no_per_class_year
  ON enrollments(institution_id, academic_year_id, class_id, roll_no) WHERE roll_no IS NOT NULL;
CREATE INDEX enrollments_class_roster ON enrollments(institution_id, academic_year_id, class_id, status, roll_no, student_id);
CREATE INDEX enrollments_student_history ON enrollments(institution_id, student_id, starts_on DESC, id);

CREATE TABLE teacher_assignments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  teacher_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  batch_id TEXT,
  subject_id TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, teacher_id) REFERENCES teachers(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, academic_year_id) REFERENCES academic_years(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, batch_id) REFERENCES batches(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, subject_id) REFERENCES subjects(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE (institution_id, id)
);
CREATE INDEX teacher_assignments_current ON teacher_assignments(institution_id, teacher_id, academic_year_id, status, class_id, subject_id);
CREATE INDEX teacher_assignments_class ON teacher_assignments(institution_id, academic_year_id, class_id, subject_id, status);

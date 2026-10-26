PRAGMA foreign_keys = ON;

CREATE TABLE attendance_sessions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  batch_id TEXT,
  session_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'locked')),
  created_by_membership_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at TEXT,
  FOREIGN KEY (institution_id, academic_year_id) REFERENCES academic_years(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, batch_id) REFERENCES batches(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, created_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  UNIQUE (institution_id, id)
);
CREATE UNIQUE INDEX attendance_one_session_per_class_day
  ON attendance_sessions(institution_id, academic_year_id, class_id, session_date)
  WHERE batch_id IS NULL;
CREATE UNIQUE INDEX attendance_one_session_per_batch_day
  ON attendance_sessions(institution_id, academic_year_id, class_id, batch_id, session_date)
  WHERE batch_id IS NOT NULL;
CREATE INDEX attendance_sessions_by_day ON attendance_sessions(institution_id, session_date DESC, id);
CREATE INDEX attendance_sessions_by_class ON attendance_sessions(institution_id, academic_year_id, class_id, session_date DESC, id);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  remarks TEXT,
  marked_by_membership_id TEXT,
  marked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, session_id) REFERENCES attendance_sessions(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, enrollment_id, student_id) REFERENCES enrollments(institution_id, id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, marked_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  UNIQUE (session_id, student_id),
  UNIQUE (institution_id, id)
);
CREATE INDEX attendance_records_student_history ON attendance_records(institution_id, student_id, marked_at DESC, id);
CREATE INDEX attendance_records_session_status ON attendance_records(institution_id, session_id, status, student_id);

CREATE TRIGGER attendance_enrollment_matches_session
BEFORE INSERT ON attendance_records
WHEN NOT EXISTS (
  SELECT 1 FROM attendance_sessions s
  JOIN enrollments e ON e.institution_id = s.institution_id
    AND e.academic_year_id = s.academic_year_id
    AND e.class_id = s.class_id
    AND (s.batch_id IS NULL OR e.batch_id = s.batch_id)
  WHERE s.institution_id = NEW.institution_id AND s.id = NEW.session_id
    AND e.id = NEW.enrollment_id AND e.student_id = NEW.student_id AND e.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'attendance enrollment does not match session');
END;

CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('school_exam', 'tuition_test')),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  subtype TEXT,
  subject_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  batch_id TEXT,
  starts_at TEXT,
  ends_at TEXT,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  max_marks INTEGER NOT NULL CHECK (max_marks > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'ongoing', 'completed', 'published', 'cancelled')),
  created_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT,
  FOREIGN KEY (institution_id, academic_year_id) REFERENCES academic_years(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, subject_id) REFERENCES subjects(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, batch_id) REFERENCES batches(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, created_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  UNIQUE (institution_id, id)
);
CREATE INDEX assessments_schedule ON assessments(institution_id, academic_year_id, assessment_type, starts_at, id);
CREATE INDEX assessments_class_status ON assessments(institution_id, academic_year_id, class_id, status, assessment_type, id);

CREATE TABLE assessment_marks (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  marks INTEGER CHECK (marks IS NULL OR marks >= 0),
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'entered', 'published')),
  entered_by_membership_id TEXT,
  entered_at TEXT,
  FOREIGN KEY (institution_id, assessment_id) REFERENCES assessments(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, enrollment_id, student_id) REFERENCES enrollments(institution_id, id, student_id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, entered_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CHECK (status = 'draft' OR marks IS NOT NULL),
  UNIQUE (assessment_id, student_id),
  UNIQUE (institution_id, id)
);
CREATE INDEX assessment_marks_by_student ON assessment_marks(institution_id, student_id, assessment_id, status);
CREATE INDEX assessment_marks_by_assessment ON assessment_marks(institution_id, assessment_id, status, student_id);

CREATE TRIGGER assessment_mark_enrollment_matches_assessment
BEFORE INSERT ON assessment_marks
WHEN NOT EXISTS (
  SELECT 1 FROM assessments a
  JOIN enrollments e ON e.institution_id = a.institution_id
    AND e.academic_year_id = a.academic_year_id
    AND e.class_id = a.class_id
    AND (a.batch_id IS NULL OR e.batch_id = a.batch_id)
  WHERE a.institution_id = NEW.institution_id AND a.id = NEW.assessment_id
    AND e.id = NEW.enrollment_id AND e.student_id = NEW.student_id AND e.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'assessment enrollment does not match assessment');
END;

CREATE TRIGGER assessment_marks_not_above_max
BEFORE INSERT ON assessment_marks
WHEN NEW.marks IS NOT NULL AND NEW.marks > (
  SELECT max_marks FROM assessments WHERE institution_id = NEW.institution_id AND id = NEW.assessment_id
)
BEGIN
  SELECT RAISE(ABORT, 'marks exceed assessment maximum');
END;

CREATE TRIGGER assessment_marks_update_not_above_max
BEFORE UPDATE OF marks, assessment_id, institution_id ON assessment_marks
WHEN NEW.marks IS NOT NULL AND NEW.marks > (
  SELECT max_marks FROM assessments WHERE institution_id = NEW.institution_id AND id = NEW.assessment_id
)
BEGIN
  SELECT RAISE(ABORT, 'marks exceed assessment maximum');
END;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  academic_year_id TEXT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  event_type TEXT NOT NULL CHECK (event_type IN ('school_exam', 'tuition_test', 'holiday', 'meeting', 'fee_event', 'other')),
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  class_id TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'archived')),
  created_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (institution_id, academic_year_id) REFERENCES academic_years(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, class_id) REFERENCES classes(institution_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (institution_id, created_by_membership_id) REFERENCES memberships(institution_id, id) ON DELETE RESTRICT,
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  UNIQUE (institution_id, id)
);
CREATE INDEX calendar_events_range ON calendar_events(institution_id, starts_at, ends_at, status, id);
CREATE INDEX calendar_events_year ON calendar_events(institution_id, academic_year_id, starts_at, id);

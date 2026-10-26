-- ==============================================================================
-- Tutorly Safe Reversible Duplicate Teacher Cleanup Script
-- Audit Date: 2026-10-26
-- Target Institution: 11125645-f1cc-49bf-b1d5-fa56df90d14a
-- Primary Record to Preserve: tch-0ab33f3a (Created: 2026-10-26T12:38:37.829Z)
-- Records to Clean: 15 identical burst duplicates created within 463ms
-- ==============================================================================

-- STEP 1: CREATE BACKUP TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS _backup_duplicate_teachers_20261026 (
  backup_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  teacher_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  teacher_code TEXT,
  phone TEXT,
  gender TEXT,
  status TEXT,
  created_at TEXT,
  backup_timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- STEP 2: BACK UP AFFECTED 15 DUPLICATE RECORDS
INSERT INTO _backup_duplicate_teachers_20261026 (teacher_id, institution_id, membership_id, teacher_code, phone, gender, status, created_at)
SELECT id, institution_id, membership_id, teacher_code, phone, gender, status, created_at
FROM teachers
WHERE institution_id = '11125645-f1cc-49bf-b1d5-fa56df90d14a'
  AND phone = '9000000101'
  AND id != 'tch-0ab33f3a';

-- STEP 3: VERIFY ZERO FOREIGN KEY REFERENCES BEFORE MODIFICATION
-- (Run this query first; if any count > 0, ABORT execution)
SELECT 
  (SELECT COUNT(*) FROM teacher_assignments WHERE teacher_id IN (SELECT teacher_id FROM _backup_duplicate_teachers_20261026)) AS referenced_assignments,
  (SELECT COUNT(*) FROM attendance_sessions WHERE created_by_membership_id IN (SELECT membership_id FROM _backup_duplicate_teachers_20261026)) AS referenced_attendance,
  (SELECT COUNT(*) FROM assessments WHERE created_by_membership_id IN (SELECT membership_id FROM _backup_duplicate_teachers_20261026)) AS referenced_assessments;

-- STEP 4: SOFT-ARCHIVE OR SAFELY PRUNE THE 15 UNREFERENCED DUPLICATE TEACHERS
-- Option A (Soft-archive - Non-destructive and 100% reversible):
UPDATE teachers
SET status = 'inactive'
WHERE institution_id = '11125645-f1cc-49bf-b1d5-fa56df90d14a'
  AND phone = '9000000101'
  AND id != 'tch-0ab33f3a';

-- Option B (Complete Pruning after explicit approval):
-- DELETE FROM teachers
-- WHERE institution_id = '11125645-f1cc-49bf-b1d5-fa56df90d14a'
--   AND phone = '9000000101'
--   AND id != 'tch-0ab33f3a';
--
-- DELETE FROM memberships
-- WHERE id IN (SELECT membership_id FROM _backup_duplicate_teachers_20261026);

-- ==============================================================================
-- ROLLBACK PROCEDURE:
-- To restore all 15 records in the event of any unforeseen issue:
-- UPDATE teachers
-- SET status = 'active'
-- WHERE id IN (SELECT teacher_id FROM _backup_duplicate_teachers_20261026);
-- ==============================================================================

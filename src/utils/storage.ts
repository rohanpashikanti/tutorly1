/**
 * Persistent Storage Layer for Tutorly
 * Uses browser localStorage to persist all changes across page reloads,
 * initialized with default mock data if not yet saved.
 */

import {
  CalendarEvent,
  Student,
  Teacher,
  ClassItem,
  BatchItem,
  SubjectItem,
  Exam,
  TuitionTest,
  FeeRecord,
  User,
  AttendanceRecord,
  StudentMarks,
  Announcement,
  HomeworkItem
} from '../types';

export const STORAGE_KEYS = {
  CALENDAR_EVENTS: 'tutorly_calendar_events',
  STUDENTS: 'tutorly_students',
  TEACHERS: 'tutorly_teachers',
  CLASSES: 'tutorly_classes',
  BATCHES: 'tutorly_batches',
  SUBJECTS: 'tutorly_subjects',
  SCHOOL_EXAMS: 'tutorly_school_exams',
  SCHOOL_EXAM_MARKS: 'tutorly_school_exam_marks',
  TUITION_TESTS: 'tutorly_tuition_tests',
  TUITION_TEST_MARKS: 'tutorly_tuition_test_marks',
  STUDENT_FEES: 'tutorly_student_fees',
  USERS: 'tutorly_users',
  INSTITUTION_SETTINGS: 'tutorly_institution_settings',
  ATTENDANCE_SESSIONS: 'tutorly_attendance_sessions',
  ANNOUNCEMENTS: 'tutorly_announcements',
  HOMEWORK: 'tutorly_homework'
};

/**
 * Generic getter from localStorage with fallback
 */
export function getStoredData<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

/**
 * Generic setter to localStorage
 */
export function setStoredData<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

/**
 * Clear all business data keys from localStorage
 */
export function clearAllStoredBusinessData(): void {
  const businessKeys = [
    STORAGE_KEYS.CALENDAR_EVENTS,
    STORAGE_KEYS.STUDENTS,
    STORAGE_KEYS.TEACHERS,
    STORAGE_KEYS.CLASSES,
    STORAGE_KEYS.BATCHES,
    STORAGE_KEYS.SUBJECTS,
    STORAGE_KEYS.SCHOOL_EXAMS,
    STORAGE_KEYS.SCHOOL_EXAM_MARKS,
    STORAGE_KEYS.TUITION_TESTS,
    STORAGE_KEYS.TUITION_TEST_MARKS,
    STORAGE_KEYS.STUDENT_FEES,
    STORAGE_KEYS.USERS,
    STORAGE_KEYS.ATTENDANCE_SESSIONS,
    STORAGE_KEYS.ANNOUNCEMENTS,
    STORAGE_KEYS.HOMEWORK,
  ];
  for (const k of businessKeys) {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Calendar Events
// ---------------------------------------------------------------------------
export function getStoredCalendarEvents(): CalendarEvent[] {
  return getStoredData<CalendarEvent[]>(STORAGE_KEYS.CALENDAR_EVENTS, []);
}

export function saveStoredCalendarEvents(events: CalendarEvent[]): void {
  setStoredData(STORAGE_KEYS.CALENDAR_EVENTS, events);
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
export function getStoredStudents(): Student[] {
  return getStoredData<Student[]>(STORAGE_KEYS.STUDENTS, []);
}

export function saveStoredStudents(students: Student[]): void {
  setStoredData(STORAGE_KEYS.STUDENTS, students);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
export function getStoredTeachers(): Teacher[] {
  return getStoredData<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
}

export function saveStoredTeachers(teachers: Teacher[]): void {
  setStoredData(STORAGE_KEYS.TEACHERS, teachers);
}

// ---------------------------------------------------------------------------
// Batches & Classes
// ---------------------------------------------------------------------------
export function getStoredBatches(): BatchItem[] {
  return getStoredData<BatchItem[]>(STORAGE_KEYS.BATCHES, []);
}

export function saveStoredBatches(batches: BatchItem[]): void {
  setStoredData(STORAGE_KEYS.BATCHES, batches);
}

export function getStoredClasses(): ClassItem[] {
  return getStoredData<ClassItem[]>(STORAGE_KEYS.CLASSES, []);
}

export function saveStoredClasses(classes: ClassItem[]): void {
  setStoredData(STORAGE_KEYS.CLASSES, classes);
}

export function getStoredSubjects(): SubjectItem[] {
  return getStoredData<SubjectItem[]>(STORAGE_KEYS.SUBJECTS, []);
}

export function saveStoredSubjects(subjects: SubjectItem[]): void {
  setStoredData(STORAGE_KEYS.SUBJECTS, subjects);
}

// ---------------------------------------------------------------------------
// School Examinations & Marks
// ---------------------------------------------------------------------------
export function getStoredSchoolExams(): Exam[] {
  return getStoredData<Exam[]>(STORAGE_KEYS.SCHOOL_EXAMS, []);
}

export function saveStoredSchoolExams(exams: Exam[]): void {
  setStoredData(STORAGE_KEYS.SCHOOL_EXAMS, exams);
}

export function getStoredSchoolExamMarks(): Record<string, StudentMarks[]> {
  return getStoredData<Record<string, StudentMarks[]>>(STORAGE_KEYS.SCHOOL_EXAM_MARKS, {});
}

export function saveStoredSchoolExamMarks(marksMap: Record<string, StudentMarks[]>): void {
  setStoredData(STORAGE_KEYS.SCHOOL_EXAM_MARKS, marksMap);
}

// ---------------------------------------------------------------------------
// Tuition Tests & Marks
// ---------------------------------------------------------------------------
export function getStoredTuitionTests(): TuitionTest[] {
  return getStoredData<TuitionTest[]>(STORAGE_KEYS.TUITION_TESTS, []);
}

export function saveStoredTuitionTests(tests: TuitionTest[]): void {
  setStoredData(STORAGE_KEYS.TUITION_TESTS, tests);
}

export function getStoredTuitionTestMarks(): Record<string, StudentMarks[]> {
  return getStoredData<Record<string, StudentMarks[]>>(STORAGE_KEYS.TUITION_TEST_MARKS, {});
}

export function saveStoredTuitionTestMarks(marksMap: Record<string, StudentMarks[]>): void {
  setStoredData(STORAGE_KEYS.TUITION_TEST_MARKS, marksMap);
}

// ---------------------------------------------------------------------------
// Attendance Sessions
// ---------------------------------------------------------------------------
export interface AttendanceSession {
  date: string;
  className: string;
  batch: string;
  records: AttendanceRecord[];
  savedAt: string;
}

export function getStoredAttendanceSessions(): Record<string, AttendanceSession> {
  return getStoredData<Record<string, AttendanceSession>>(STORAGE_KEYS.ATTENDANCE_SESSIONS, {});
}

export function saveStoredAttendanceSession(sessionKey: string, session: AttendanceSession): void {
  const current = getStoredAttendanceSessions();
  current[sessionKey] = session;
  setStoredData(STORAGE_KEYS.ATTENDANCE_SESSIONS, current);
}

// ---------------------------------------------------------------------------
// Student Fees
// ---------------------------------------------------------------------------
export function getStoredStudentFees(): FeeRecord[] {
  return getStoredData<FeeRecord[]>(STORAGE_KEYS.STUDENT_FEES, []);
}

export function saveStoredStudentFees(fees: FeeRecord[]): void {
  setStoredData(STORAGE_KEYS.STUDENT_FEES, fees);
}

export const getStoredFeeRecords = getStoredStudentFees;
export const saveStoredFeeRecords = saveStoredStudentFees;

// ---------------------------------------------------------------------------
// Users & Permissions
// ---------------------------------------------------------------------------
export function getStoredUsers(): User[] {
  return getStoredData<User[]>(STORAGE_KEYS.USERS, []);
}

export function saveStoredUsers(users: User[]): void {
  setStoredData(STORAGE_KEYS.USERS, users);
}

// ---------------------------------------------------------------------------
// Institution Settings
// ---------------------------------------------------------------------------
export interface InstitutionSettingsConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  defaultStartTime: string;
  defaultEndTime: string;
  workingDays: string[];
  currency: string;
  timezone: string;
  passingPercentage?: number;
  attendanceThreshold?: number;
  termCount?: number;
  feeReceiptPrefix?: string;
  defaultDueDays?: number;
  allowPartialPayments?: boolean;
  attendanceAlerts?: boolean;
  testResultAlerts?: boolean;
  feeReminders?: boolean;
}

export const DEFAULT_INSTITUTION_CONFIG: InstitutionSettingsConfig = {
  name: 'My Tuition Center',
  shortName: 'Tuition Center',
  tagline: 'Quality Education & Personalized Guidance',
  description: 'Tuition and coaching center management powered by Tutorly.',
  phone: '',
  email: '',
  website: '',
  address: '',
  academicYear: '2026 - 2027',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  defaultStartTime: '09:00 AM',
  defaultEndTime: '08:00 PM',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  currency: 'INR (₹)',
  timezone: '(GMT+05:30) India Standard Time',
  passingPercentage: 40,
  attendanceThreshold: 75,
  termCount: 2,
  feeReceiptPrefix: 'REC-',
  defaultDueDays: 10,
  allowPartialPayments: true,
  attendanceAlerts: true,
  testResultAlerts: true,
  feeReminders: true,
};

export function getStoredInstitutionSettings(): InstitutionSettingsConfig {
  return getStoredData<InstitutionSettingsConfig>(STORAGE_KEYS.INSTITUTION_SETTINGS, DEFAULT_INSTITUTION_CONFIG);
}

export function saveStoredInstitutionSettings(settings: InstitutionSettingsConfig): void {
  setStoredData(STORAGE_KEYS.INSTITUTION_SETTINGS, settings);
}

// ---------------------------------------------------------------------------
// Announcements & Homework
// ---------------------------------------------------------------------------
export function getStoredAnnouncements(): Announcement[] {
  return getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
}

export function saveStoredAnnouncements(announcements: Announcement[]): void {
  setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
}

export function getStoredHomework(): HomeworkItem[] {
  return getStoredData<HomeworkItem[]>(STORAGE_KEYS.HOMEWORK, []);
}

export function saveStoredHomework(homework: HomeworkItem[]): void {
  setStoredData(STORAGE_KEYS.HOMEWORK, homework);
}


export type UserRole = 'admin' | 'teacher' | 'parent';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  institutionName: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  linkedChildrenIds?: string[];
  status: 'active' | 'inactive';
  lastActive?: string;
}

export interface Student {
  id: string;
  rollNo: string;
  admissionNo: string;
  name: string;
  avatar: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  age: number;
  class: string;
  batch: string;
  admissionDate: string;
  status: 'Active' | 'Inactive' | 'Needs Attention';
  attendanceRate: number;
  attendancePercentage?: number;
  averageScore?: number;
  phone?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  parent: {
    fatherName: string;
    motherName?: string;
    phone: string;
    email: string;
    address: string;
  };
  academic: {
    schoolExamAvg: number;
    tuitionTestAvg: number;
    pendingHomework: number;
    rank: number;
    subjectScores: Record<string, number>;
  };
  fees: {
    totalFee: number;
    paidAmount: number;
    pendingAmount: number;
    nextDue: string;
    nextDueAmount: number;
    status: 'Paid' | 'Pending' | 'Overdue';
  };
}

export interface Teacher {
  id: string;
  code: string;
  name: string;
  designation: string;
  avatar: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female';
  address: string;
  subjects: string[];
  subject?: string;
  classes: string[];
  status: 'Active' | 'Inactive';
  totalStudents: number;
  totalClasses: number;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  sections: string[];
  totalStudents: number;
  subjectsCount: number;
  classTeacher: string;
  teacherAvatar: string;
  status: 'Active' | 'Inactive';
}

export interface BatchItem {
  id: string;
  name: string;
  className: string;
  classId?: string;
  timing: string;
  studentsCount: number;
  teacher: string;
  days: string[];
}

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
  classes: string[];
  isCore: boolean;
  color: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  avatar: string;
  status: 'Present' | 'Absent' | 'Late' | 'Not Marked';
  remarks?: string;
}

export interface Exam {
  id: string;
  name: string;
  type: 'Unit Test' | 'Term Exam' | 'Pre-Final' | 'Final';
  classes: string;
  subjectsCount: number;
  startDate: string;
  endDate: string;
  status: 'Completed' | 'Ongoing' | 'Upcoming';
  academicYear: string;
}

export interface TuitionTest {
  id: string;
  name: string;
  type: 'Unit Test' | 'Practice Test' | 'Chapter Test' | 'Model Test';
  class: string;
  batch?: string;
  subject: string;
  dateTime: string;
  durationMinutes: number;
  maxMarks: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Scheduled';
  averageScore?: number | null;
}

export interface StudentMarks {
  studentId: string;
  studentName: string;
  rollNo: string;
  avatar: string;
  marks: number | null;
  maxMarks: number;
  grade: string;
  percentage: number | null;
  remarks: string;
  status: 'Draft' | 'Entered' | 'Published';
}

export interface FeePlan {
  id: string;
  name: string;
  type: 'Tuition Fee' | 'Special Batch' | 'Subject-wise' | 'Entrance Prep';
  classes: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'One-time';
  status: 'Active' | 'Inactive';
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  avatar: string;
  class: string;
  feePlan: string;
  totalFees: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
  paymentMethod?: 'UPI' | 'Cash' | 'Card' | 'Bank Transfer';
  paymentDate?: string;
  transactionId?: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  receiptNo?: string;
  parentName?: string;
  phone?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience?: 'All' | 'Teachers' | 'Parents';
  targetAudience?: 'All' | 'Teachers' | 'Parents';
  date: string;
  author: string;
  priority: 'Normal' | 'Medium' | 'High' | 'Urgent';
  readByCount?: number;
  pinned?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'School Exam' | 'Tuition Test' | 'Holiday' | 'Meeting' | 'Fee Event';
  date: string;
  endDate?: string;
  time?: string;
  applicableClass?: string;
  description?: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  subject: string;
  class: string;
  batch?: string;
  assignedDate: string;
  dueDate: string;
  status?: 'Pending' | 'Submitted' | 'Overdue';
  teacherName?: string;
  assignedBy?: string;
  description?: string;
  submittedCount?: number;
  totalCount?: number;
  submissionsCount?: number;
  totalStudents?: number;
}

export interface AcademicYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: 'planned' | 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
  enrolled_students?: number;
}


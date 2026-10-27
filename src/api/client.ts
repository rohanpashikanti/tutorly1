import {
  Student,
  Teacher,
  ClassItem,
  BatchItem,
  SubjectItem,
  AttendanceRecord,
  Exam,
  TuitionTest,
  StudentMarks,
  FeePlan,
  FeeRecord,
  Announcement,
  CalendarEvent,
  AcademicYear,
} from '../types';
import { beginMutation } from '../pwa/updateSafety';

let activeApiSessionScope: string | null = null;
let apiSessionGeneration = 0;
const pendingApiRequests = new Set<AbortController>();
const responseSessionGenerations = new WeakMap<Response, number>();

function staleSessionError(): Error {
  const error = new Error('The authenticated session changed before this request completed.');
  error.name = 'AbortError';
  return error;
}

export function setApiSessionScope(scope: string | null): void {
  if (activeApiSessionScope === scope) return;
  activeApiSessionScope = scope;
  apiSessionGeneration++;
  for (const controller of pendingApiRequests) controller.abort();
  pendingApiRequests.clear();
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!activeApiSessionScope && !requestUrl.includes('/api/session')) throw staleSessionError();
  const generation = apiSessionGeneration;
  const controller = new AbortController();
  pendingApiRequests.add(controller);
  const isMutation = Boolean(
    init.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init.method.toUpperCase())
  );
  const endMutation = isMutation ? beginMutation(`API ${init.method?.toUpperCase()} in-flight`) : undefined;
  try {
    const response = await fetch(input, {
      ...init,
      credentials: init.credentials ?? 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (generation !== apiSessionGeneration) throw staleSessionError();
    responseSessionGenerations.set(response, generation);
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tutorly:session-expired'));
    }
    return response;
  } catch (error) {
    if (generation !== apiSessionGeneration) throw staleSessionError();
    throw error;
  } finally {
    endMutation?.();
    pendingApiRequests.delete(controller);
  }
}

function assertResponseSessionCurrent(response: Response): void {
  const generation = responseSessionGenerations.get(response);
  if (generation !== undefined && generation !== apiSessionGeneration) throw staleSessionError();
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    assertResponseSessionCurrent(res);
    throw new Error(errorJson.error || errorJson.message || `Request failed with status ${res.status}`);
  }
  const body = (await res.json()) as T;
  assertResponseSessionCurrent(res);
  return body;
}

export function getJsonHeaders(data?: any): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = data?.idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
  if (key) {
    headers['idempotency-key'] = String(key);
  }
  return headers;
}


export const api = {
  // Session & Tenants
  session: {
    async get() {
      const res = await apiFetch('/api/session', { credentials: 'same-origin' });
      if (!res.ok) return null;
      return await res.json();
    },
    async createInstitution(institutionName: string) {
      const res = await apiFetch('/api/institutions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ institutionName }),
      });
      return handleResponse<{ institutionId: string; institutionName: string; role: string }>(res);
    },
  },

  // Institution Settings
  settings: {
    async get(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/settings`, { credentials: 'same-origin' });
      return handleResponse<{ settings: Record<string, any> }>(res);
    },
    async update(institutionId: string, settings: Record<string, any>) {
      const res = await apiFetch(`/api/institutions/${institutionId}/settings`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return handleResponse<{ success: boolean }>(res);
    },
  },

  // Academics (Classes, Batches, Subjects)
  academics: {
    async getOverview(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academics/overview`, { credentials: 'same-origin' });
      return handleResponse<{
        classes: ClassItem[];
        batches: BatchItem[];
        subjects: SubjectItem[];
        academicYears: any[];
      }>(res);
    },
    async createClass(institutionId: string, data: { name: string; code?: string; idempotencyKey?: string }) {
      const res = await apiFetch(`/api/institutions/${institutionId}/classes`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; id: string; name: string }>(res);
    },
    async createBatch(
      institutionId: string,
      data: { className?: string; classId?: string; name: string; timing?: string; days?: string[]; idempotencyKey?: string }
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/batches`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; id: string; name: string }>(res);
    },
    async createSubject(
      institutionId: string,
      data: { name: string; code?: string; isCore?: boolean; color?: string; idempotencyKey?: string }
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/subjects`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; id: string; name: string }>(res);
    },
    async listAcademicYears(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years`, { credentials: 'same-origin' });
      return handleResponse<{ academicYears: AcademicYear[] }>(res);
    },
    async createAcademicYear(institutionId: string, data: { name: string; startsOn: string; endsOn: string; status?: string; idempotencyKey?: string }) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; academicYear: AcademicYear }>(res);
    },
    async updateAcademicYear(institutionId: string, id: string, data: { name?: string; startsOn?: string; endsOn?: string; status?: string }) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; academicYear: AcademicYear }>(res);
    },
    async activateAcademicYear(institutionId: string, id: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years/${id}/activate`, {
        method: 'PUT',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; activeId: string }>(res);
    },
    async archiveAcademicYear(institutionId: string, id: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years/${id}/archive`, {
        method: 'PUT',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; archivedId: string }>(res);
    },
    async deleteAcademicYear(institutionId: string, id: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/academic-years/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; deletedId: string }>(res);
    },
  },

  // Teachers
  teachers: {
    async list(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/teachers`, { credentials: 'same-origin' });
      return handleResponse<{ teachers: Teacher[] }>(res);
    },
    async create(institutionId: string, data: any) {
      const res = await apiFetch(`/api/institutions/${institutionId}/teachers`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; teacherId: string }>(res);
    },
    async update(institutionId: string, teacherId: string, data: any) {
      const res = await apiFetch(`/api/institutions/${institutionId}/teachers/${teacherId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean }>(res);
    },
    async delete(institutionId: string, teacherId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/teachers/${teacherId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; teacherId: string }>(res);
    },
  },

  // Students
  students: {
    async list(
      institutionId: string,
      filters?: { search?: string; class?: string; batch?: string; status?: string; page?: number; limit?: number }
    ) {
      const params = new URLSearchParams();
      params.set('page', String(filters?.page ?? 1));
      params.set('limit', String(filters?.limit ?? 25));
      if (filters?.search) params.set('search', filters.search);
      if (filters?.class) params.set('class', filters.class);
      if (filters?.batch) params.set('batch', filters.batch);
      if (filters?.status) params.set('status', filters.status);
      const res = await apiFetch(`/api/institutions/${institutionId}/students?${params.toString()}`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        students: Student[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        summary: { total: number; active: number; inactive: number; classes: number };
      }>(res);
    },
    async listAll(institutionId: string, filters?: { search?: string; class?: string; batch?: string; status?: string }) {
      const firstPage = await api.students.list(institutionId, { ...filters, page: 1, limit: 100 });
      const students = [...firstPage.students];
      for (let currentPage = 2; currentPage <= firstPage.totalPages; currentPage += 1) {
        const result = await api.students.list(institutionId, { ...filters, page: currentPage, limit: 100 });
        students.push(...result.students);
      }
      return students;
    },
    async get(institutionId: string, studentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/students/${studentId}`, {
        credentials: 'same-origin',
      });
      return handleResponse<{ student: any }>(res);
    },
    async create(institutionId: string, data: any) {
      const res = await apiFetch(`/api/institutions/${institutionId}/students`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; studentId: string; admissionNo: string }>(res);
    },
    async update(institutionId: string, studentId: string, data: Partial<Student> & { fatherName?: string }) {
      const res = await apiFetch(`/api/institutions/${institutionId}/students/${studentId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean }>(res);
    },
    async delete(institutionId: string, studentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/students/${studentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean }>(res);
    },
  },

  // Attendance
  attendance: {
    async getRegister(
      institutionId: string,
      params: { date?: string; class?: string; batch?: string }
    ) {
      const q = new URLSearchParams();
      if (params.date) q.set('date', params.date);
      if (params.class) q.set('class', params.class);
      if (params.batch) q.set('batch', params.batch);
      const res = await apiFetch(`/api/institutions/${institutionId}/attendance/register?${q.toString()}`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        sessionId: string | null;
        isSubmitted: boolean;
        records: AttendanceRecord[];
      }>(res);
    },
    async submit(
      institutionId: string,
      data: { date: string; class: string; batch: string; records: any[]; idempotencyKey?: string }
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/attendance/submit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; sessionId: string }>(res);
    },
    async getReports(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/attendance/reports`, {
        credentials: 'same-origin',
      });
      return handleResponse<any>(res);
    },
  },

  // Assessments (Exams & Tests)
  assessments: {
    async listExams(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments?type=school_exam`, {
        credentials: 'same-origin',
      });
      return handleResponse<{ exams: Exam[] }>(res);
    },
    async listTests(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments?type=tuition_test`, {
        credentials: 'same-origin',
      });
      return handleResponse<{ tests: TuitionTest[] }>(res);
    },
    async create(institutionId: string, data: any) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; assessmentId: string }>(res);
    },
    async getMarks(institutionId: string, assessmentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments/${assessmentId}/marks`, {
        credentials: 'same-origin',
      });
      return handleResponse<{ assessment: any; marks: StudentMarks[] }>(res);
    },
    async saveMarks(
      institutionId: string,
      assessmentId: string,
      marks: Array<{ studentId: string; enrollmentId?: string; marks?: number | null; remarks?: string | null }>
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments/${assessmentId}/marks`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marks }),
      });
      return handleResponse<{ success: boolean }>(res);
    },
    async delete(institutionId: string, assessmentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/assessments/${assessmentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean }>(res);
    },
  },

  // Fees & Payments
  fees: {
    async getPlans(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/fees/plans`, { credentials: 'same-origin' });
      return handleResponse<{ plans: FeePlan[] }>(res);
    },
    async getRecords(institutionId: string, params?: { page?: number; limit?: number }) {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await apiFetch(`/api/institutions/${institutionId}/fees/records${qs}`, { credentials: 'same-origin' });
      return handleResponse<{
        records: FeeRecord[];
        total?: number;
        totalPages?: number;
        page?: number;
        limit?: number;
        summary?: {
          totalAssigned: number;
          totalCollected: number;
          totalOutstanding: number;
          fullyPaidCount: number;
          unpaidCount: number;
          partialCount: number;
        };
      }>(res);
    },
    async recordPayment(
      institutionId: string,
      data: {
        studentId: string;
        amount: number;
        method: string;
        notes?: string;
        paymentDate?: string;
        externalReference?: string;
        idempotencyKey: string;
      }
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/fees/payments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getJsonHeaders(data),
        body: JSON.stringify(data),
      });
      const result = await handleResponse<{
        success: boolean;
        paymentId: string;
        receiptNo: string;
        amount: number;
        studentName: string;
        paymentDate?: string;
        externalReference?: string;
      }>(res);
      if (!result.success || !result.paymentId || !result.receiptNo) {
        throw new Error('The server did not confirm that the payment was recorded.');
      }
      return result;
    },
    async getPayments(institutionId: string, params?: { page?: number; limit?: number }) {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await apiFetch(`/api/institutions/${institutionId}/fees/payments${qs}`, { credentials: 'same-origin' });
      return handleResponse<{
        payments: any[];
        total?: number;
        totalPages?: number;
        page?: number;
        limit?: number;
      }>(res);
    },

    async getReports(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/fees/reports`, { credentials: 'same-origin' });
      return handleResponse<any>(res);
    },
  },

  // Calendar
  calendar: {
    async list(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/calendar/events`, { credentials: 'same-origin' });
      return handleResponse<{ events: CalendarEvent[] }>(res);
    },
    async create(institutionId: string, data: Partial<CalendarEvent>) {
      const res = await apiFetch(`/api/institutions/${institutionId}/calendar/events`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; eventId: string }>(res);
    },
    async delete(institutionId: string, eventId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/calendar/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean }>(res);
    },
  },

  // Announcements
  announcements: {
    async list(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/announcements`, { credentials: 'same-origin' });
      return handleResponse<{ announcements: Announcement[] }>(res);
    },
    async create(institutionId: string, data: Partial<Announcement>) {
      const res = await apiFetch(`/api/institutions/${institutionId}/announcements`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ success: boolean; announcementId: string }>(res);
    },
    async delete(institutionId: string, announcementId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/announcements/${announcementId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean }>(res);
    },
  },

  // Users & Permissions
  users: {
    async list(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/users`, { credentials: 'same-origin' });
      return handleResponse<{ users: any[] }>(res);
    },
    async create(
      institutionId: string,
      data: {
        name: string;
        email: string;
        role: string;
        password?: string;
        designation?: string;
        phone?: string;
        address?: string;
        assignments?: any[];
        studentIds?: string[];
        relationship?: string;
      }
    ) {
      const res = await apiFetch(`/api/institutions/${institutionId}/users`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{
        success: boolean;
        user: { id: string; membershipId: string; name: string; email: string; role: string };
        isNewAccount: boolean;
        temporaryPassword?: string;
      }>(res);
    },
    async updateStatus(institutionId: string, membershipId: string, status: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/users/${membershipId}/status`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return handleResponse<{ success: boolean; status: string }>(res);
    },
    async resetPassword(institutionId: string, membershipId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/users/${membershipId}/reset-password`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; temporaryPassword: string; message: string }>(res);
    },
    async resendInvite(institutionId: string, membershipId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/users/${membershipId}/resend-invite`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      return handleResponse<{ success: boolean; temporaryPassword: string; message: string }>(res);
    },
  },

  // Dashboard & Analytics
  dashboard: {
    async getSummary(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/dashboard/summary`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        stats: {
          totalStudents: number;
          totalTeachers: number;
          totalClasses: number;
          totalBatches: number;
          todayAttendanceRate: number;
          todayPresentCount: number;
          todayAbsentCount: number;
          currentMonthFees: number;
        };
        upcomingEvents: any[];
        monthlyCollections: any[];
      }>(res);
    },
  },

  // Portals
  portals: {
    async getParent(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/parent/portal`, {
        credentials: 'same-origin',
      });
      return handleResponse<{ guardian: any; children: any[] }>(res);
    },
    async getChildFees(institutionId: string, studentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/parent/children/${studentId}/fees`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        studentId: string;
        studentName: string;
        totalBilled: number;
        totalPaid: number;
        dueAmount: number;
        totalRemaining: number;
        status: string;
        dueDate: string;
        payments: any[];
      }>(res);
    },
    async getChildAttendance(institutionId: string, studentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/parent/children/${studentId}/attendance`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        studentId: string;
        totalSessions: number;
        presentCount: number;
        absentCount: number;
        lateCount: number;
        attendanceRate: number;
        records: any[];
      }>(res);
    },
    async getChildAcademicResults(institutionId: string, studentId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/parent/children/${studentId}/academics`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        studentId: string;
        studentName: string;
        results: Array<{
          id: string;
          assessmentId: string;
          date: string;
          name: string;
          category: 'Tuition Test' | 'School Examination';
          type: string;
          subject: string;
          marksObtained: number | null;
          maxMarks: number;
          percentage: number | null;
          status: string;
          remarks?: string | null;
          academicYear?: string | null;
          className?: string | null;
          batchName?: string | null;
        }>;
      }>(res);
    },
    async getTeacher(institutionId: string) {
      const res = await apiFetch(`/api/institutions/${institutionId}/teacher/portal`, {
        credentials: 'same-origin',
      });
      return handleResponse<{
        teacher: any;
        totalAssignedStudents: number;
        assignedBatches: any[];
      }>(res);
    },
  },
};

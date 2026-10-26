import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';
import { User, UserRole, Student } from '../types';
import { getStoredStudents } from '../utils/storage';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface Membership {
  institutionId: string;
  institutionName: string;
  role: 'owner' | 'admin' | 'teacher' | 'parent';
  status: 'active';
}

interface AuthSession {
  user: { id: string; name: string; email: string };
  memberships: Membership[];
}

interface AppContextType {
  currentUser: User;
  role: UserRole;
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  memberships: Membership[];
  activeInstitutionId: string;
  setActiveInstitutionId: (id: string) => void;
  hasMembership: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  createInstitution: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  currentRoute: string;
  navigateTo: (route: string, params?: { studentId?: string; batchId?: string }) => void;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  institutionName: string;
  setInstitutionName: (name: string) => void;
  selectedChildId: string;
  setSelectedChildId: (id: string) => void;
  selectedChild: Student;
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  selectedBatchId: string;
  setSelectedBatchId: (id: string) => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const authClient = createAuthClient({ baseURL: window.location.origin, basePath: '/api/auth' });
const AppContext = createContext<AppContextType | undefined>(undefined);

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
  return payload.error || payload.message || 'The request could not be completed.';
}

async function requestSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/session', { credentials: 'same-origin' });
  if (!response.ok) return null;
  return await response.json() as AuthSession;
}

const EMPTY_STUDENT: Student = {
  id: '',
  name: 'No student selected',
  rollNo: '—',
  admissionNo: '—',
  avatar: '',
  gender: 'Male',
  dob: '',
  age: 0,
  class: '—',
  batch: '—',
  admissionDate: '',
  status: 'Active',
  attendanceRate: 0,
  attendancePercentage: 0,
  averageScore: 0,
  parentName: '',
  parentPhone: '',
  parent: { fatherName: '', phone: '', email: '', address: '' },
  academic: { schoolExamAvg: 0, tuitionTestAvg: 0, pendingHomework: 0, rank: 0, subjectScores: {} },
  fees: { totalFee: 0, paidAmount: 0, pendingAmount: 0, nextDue: '—', nextDueAmount: 0, status: 'Paid' },
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeInstitutionId, setActiveInstitutionId] = useState('');
  const [currentRoute, setCurrentRoute] = useState('admin-dashboard');
  const [academicYear, setAcademicYear] = useState('Academic Year 2026 - 2027');
  const [institutionNameOverride, setInstitutionNameOverride] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const restoreSession = useCallback(async (showLoading = true) => {
    if (showLoading) setIsAuthLoading(true);
    try {
      const payload = await requestSession();
      if (!payload) {
        setSession(null);
        return;
      }
      setSession(payload);
      setActiveInstitutionId((existing) => payload.memberships.some((membership) => membership.institutionId === existing)
        ? existing
        : payload.memberships[0]?.institutionId || '');
      setCurrentRoute(payload.memberships.length ? 'admin-dashboard' : 'onboarding');
    } catch {
      setSession(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void requestSession().then((payload) => {
      if (cancelled) return;
      setSession(payload);
      setActiveInstitutionId(payload?.memberships[0]?.institutionId || '');
      setCurrentRoute(payload?.memberships.length ? 'admin-dashboard' : payload ? 'onboarding' : 'login');
    }).catch(() => {
      if (!cancelled) setSession(null);
    }).finally(() => {
      if (!cancelled) setIsAuthLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const activeMembership = session?.memberships.find((membership) => membership.institutionId === activeInstitutionId);
  const role: UserRole = activeMembership?.role === 'teacher' ? 'teacher' : activeMembership?.role === 'parent' ? 'parent' : 'admin';
  const currentUser = useMemo<User>(() => ({
    id: session?.user.id || '',
    name: session?.user.name || 'Account',
    email: session?.user.email || '',
    role,
    institutionName: activeMembership?.institutionName || '',
    status: 'active',
  }), [activeMembership, role, session?.user]);
  const institutionName = institutionNameOverride || activeMembership?.institutionName || '';

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000);
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const login = async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) throw new Error(result.error.message || 'Email or password was not accepted.');
    await restoreSession();
    showToast('Signed in successfully.', 'success');
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authClient.signUp.email({ name, email, password });
    if (result.error) throw new Error(result.error.message || 'Account creation failed.');
    await restoreSession();
  };

  const createInstitution = async (name: string) => {
    const response = await fetch('/api/institutions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ institutionName: name }),
    });
    if (!response.ok) throw new Error(await readApiError(response));
    const created = await response.json() as { institutionId: string };
    await restoreSession();
    setActiveInstitutionId(created.institutionId);
    setCurrentRoute('admin-dashboard');
  };

  const logout = async () => {
    await authClient.signOut();
    setSession(null);
    setActiveInstitutionId('');
    setCurrentRoute('login');
    showToast('You have been logged out.', 'info');
  };

  const navigateTo = (route: string, params?: { studentId?: string; batchId?: string }) => {
    if (params?.studentId) setSelectedStudentId(params.studentId);
    if (params?.batchId) setSelectedBatchId(params.batchId);
    setCurrentRoute(route);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedChild = getStoredStudents().find((student) => student.id === selectedChildId) || EMPTY_STUDENT;

  return (
    <AppContext.Provider value={{
      currentUser, role, isLoggedIn: Boolean(session), isAuthLoading,
      memberships: session?.memberships || [], activeInstitutionId,
      setActiveInstitutionId, hasMembership: Boolean(activeMembership),
      login, register, createInstitution, logout, currentRoute, navigateTo,
      academicYear, setAcademicYear, institutionName,
      setInstitutionName: setInstitutionNameOverride,
      selectedChildId, setSelectedChildId, selectedChild,
      selectedStudentId, setSelectedStudentId, selectedBatchId, setSelectedBatchId,
      toasts, showToast, dismissToast, isMobileMenuOpen, setIsMobileMenuOpen,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createAuthClient } from 'better-auth/react';
import { User, UserRole, Student } from '../types';
import { api, setApiSessionScope } from '../api/client';
import {
  activateVerifiedStorageScope,
  clearAllStoredBusinessData,
  clearLegacyStoredBusinessData,
  getStoredStudents,
} from '../utils/storage';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  action?: ToastAction;
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
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error', action?: ToastAction) => void;
  dismissToast: (id: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const authClient = createAuthClient({ baseURL: window.location.origin, basePath: '/api/auth' });
const AppContext = createContext<AppContextType | undefined>(undefined);
const SESSION_BOUNDARY_CHANNEL = 'tutorly-session-boundary';

function broadcastSessionBoundary(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(SESSION_BOUNDARY_CHANNEL);
  channel.postMessage('session-changing');
  channel.close();
}

async function requestSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
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
  const transitionGeneration = useRef(0);

  const clearTransientPrivateState = useCallback(() => {
    setSelectedChildId('');
    setSelectedStudentId(null);
    setSelectedBatchId('');
    setInstitutionNameOverride('');
  }, []);

  const beginSessionTransition = useCallback((clearPrivateCache: boolean) => {
    const generation = ++transitionGeneration.current;
    setIsAuthLoading(true);
    setSession(null);
    setActiveInstitutionId('');
    clearTransientPrivateState();
    activateVerifiedStorageScope(null);
    setApiSessionScope(null);
    if (clearPrivateCache) clearAllStoredBusinessData();
    return generation;
  }, [clearTransientPrivateState]);

  const setActiveInstitution = useCallback((institutionId: string) => {
    const membership = session?.memberships.find((item) => item.institutionId === institutionId);
    if (!membership || institutionId === activeInstitutionId || !session) return;
    const scope = { userId: session.user.id, institutionId, role: membership.role };
    const scopeToken = activateVerifiedStorageScope(scope);
    setApiSessionScope(scopeToken);
    setActiveInstitutionId(institutionId);
    clearTransientPrivateState();
    setCurrentRoute(membership.role === 'teacher' ? 'teacher-dashboard' : membership.role === 'parent' ? 'parent-dashboard' : 'admin-dashboard');
  }, [activeInstitutionId, clearTransientPrivateState, session]);

  const restoreSession = useCallback(async (preferredInstitutionId?: string, clearPrivateCache = false, initialLoad = false) => {
    const generation = initialLoad ? ++transitionGeneration.current : beginSessionTransition(clearPrivateCache);
    try {
      const payload = await requestSession();
      if (generation !== transitionGeneration.current) return;
      if (!payload) {
        clearAllStoredBusinessData();
        setSession(null);
        setCurrentRoute('login');
        return;
      }
      const membership = payload.memberships.find((item) => item.institutionId === preferredInstitutionId)
        || payload.memberships[0];
      const nextId = membership?.institutionId || '';
      const scopeToken = membership
        ? activateVerifiedStorageScope({ userId: payload.user.id, institutionId: nextId, role: membership.role })
        : null;
      setApiSessionScope(scopeToken);
      setSession(payload);
      setActiveInstitutionId(nextId);
      setCurrentRoute(!membership ? 'onboarding' : membership.role === 'teacher' ? 'teacher-dashboard' : membership.role === 'parent' ? 'parent-dashboard' : 'admin-dashboard');
    } catch {
      if (generation !== transitionGeneration.current) return;
      clearAllStoredBusinessData();
      setSession(null);
      setCurrentRoute('login');
    } finally {
      if (generation === transitionGeneration.current) setIsAuthLoading(false);
    }
  }, [beginSessionTransition]);

  useEffect(() => {
    clearLegacyStoredBusinessData();
    void restoreSession(undefined, false, true);
    const generationRef = transitionGeneration;
    return () => { generationRef.current++; };
  }, [restoreSession]);

  useEffect(() => {
    const handleSessionExpired = () => {
      broadcastSessionBoundary();
      void restoreSession();
    };
    window.addEventListener('tutorly:session-expired', handleSessionExpired);
    return () => window.removeEventListener('tutorly:session-expired', handleSessionExpired);
  }, [restoreSession]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(SESSION_BOUNDARY_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data !== 'session-changing') return;
      beginSessionTransition(true);
      setCurrentRoute('login');
      setIsAuthLoading(false);
    };
    return () => channel.close();
  }, [beginSessionTransition]);

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

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success',
    action?: ToastAction
  ) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), action ? 6000 : 4000);
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const login = async (email: string, password: string) => {
    broadcastSessionBoundary();
    beginSessionTransition(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || 'Email or password was not accepted.');
      await restoreSession();
      showToast('Signed in successfully.', 'success');
    } catch (error) {
      setIsAuthLoading(false);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    broadcastSessionBoundary();
    beginSessionTransition(true);
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) throw new Error(result.error.message || 'Account creation failed.');
      await restoreSession();
    } catch (error) {
      setIsAuthLoading(false);
      throw error;
    }
  };

  const createInstitution = async (name: string) => {
    const created = await api.session.createInstitution(name);
    await restoreSession(created.institutionId);
  };

  const logout = async () => {
    broadcastSessionBoundary();
    beginSessionTransition(true);
    setCurrentRoute('login');
    try {
      await authClient.signOut();
    } finally {
      setIsAuthLoading(false);
      showToast('You have been logged out.', 'info');
    }
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
      setActiveInstitutionId: setActiveInstitution, hasMembership: Boolean(activeMembership),
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

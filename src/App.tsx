import React, { Component, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { PwaControls } from './pwa/PwaControls';

import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

function lazyNamedPage(loader: () => Promise<Record<string, React.ComponentType<any>>>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    const page = module[exportName];
    if (!page) throw new Error(`Page export ${exportName} was not found`);
    return { default: page };
  });
}

const LoginPage = lazyNamedPage(() => import('./pages/auth/LoginPage'), 'LoginPage');
const AdminDashboard = lazyNamedPage(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const StudentDirectory = lazyNamedPage(() => import('./pages/admin/StudentDirectory'), 'StudentDirectory');
const StudentProfilePage = lazyNamedPage(() => import('./pages/admin/StudentProfilePage'), 'StudentProfilePage');
const TeacherManagement = lazyNamedPage(() => import('./pages/admin/TeacherManagement'), 'TeacherManagement');
const ClassesBatchesSubjects = lazyNamedPage(() => import('./pages/admin/ClassesBatchesSubjects'), 'ClassesBatchesSubjects');
const AcademicCalendarPage = lazyNamedPage(() => import('./pages/admin/AcademicCalendarPage'), 'AcademicCalendarPage');
const AttendanceRegisterPage = lazyNamedPage(() => import('./pages/admin/AttendanceRegisterPage'), 'AttendanceRegisterPage');
const AttendanceReportsPage = lazyNamedPage(() => import('./pages/admin/AttendanceReportsPage'), 'AttendanceReportsPage');
const SchoolExaminationsPage = lazyNamedPage(() => import('./pages/admin/SchoolExaminationsPage'), 'SchoolExaminationsPage');
const TuitionTestsPage = lazyNamedPage(() => import('./pages/admin/TuitionTestsPage'), 'TuitionTestsPage');
const AcademicAnalyticsPage = lazyNamedPage(() => import('./pages/admin/AcademicAnalyticsPage'), 'AcademicAnalyticsPage');
const StudentFeesPage = lazyNamedPage(() => import('./pages/admin/StudentFeesPage'), 'StudentFeesPage');
const UserManagementPage = lazyNamedPage(() => import('./pages/admin/UserManagementPage'), 'UserManagementPage');
const InstitutionSettingsPage = lazyNamedPage(() => import('./pages/admin/InstitutionSettingsPage'), 'InstitutionSettingsPage');
const ReportsCenterPage = lazyNamedPage(() => import('./pages/admin/ReportsCenterPage'), 'ReportsCenterPage');
const TeacherDashboard = lazyNamedPage(() => import('./pages/teacher/TeacherDashboard'), 'TeacherDashboard');
const TeacherClassesPage = lazyNamedPage(() => import('./pages/teacher/TeacherClassesPage'), 'TeacherClassesPage');
const TeacherStudentDetailPage = lazyNamedPage(() => import('./pages/teacher/TeacherStudentDetailPage'), 'TeacherStudentDetailPage');
const ParentDashboard = lazyNamedPage(() => import('./pages/parent/ParentDashboard'), 'ParentDashboard');
const ParentAcademicProgress = lazyNamedPage(() => import('./pages/parent/ParentAcademicProgress'), 'ParentAcademicProgress');
const ParentAttendancePage = lazyNamedPage(() => import('./pages/parent/ParentAttendancePage'), 'ParentAttendancePage');
const ParentFeesPage = lazyNamedPage(() => import('./pages/parent/ParentFeesPage'), 'ParentFeesPage');

class LazyPageErrorBoundary extends Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" style={{ padding: '48px 24px', textAlign: 'center', color: '#334155' }}>
          <h2 style={{ marginBottom: '8px' }}>This page could not be loaded</h2>
          <p style={{ marginBottom: '16px' }}>Check your connection, then reload Tutorly to try again.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Tutorly</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageLoadingFallback = () => (
  <div role="status" aria-live="polite" style={{ minHeight: '240px', display: 'grid', placeItems: 'center', color: '#64748B', fontSize: '14px' }}>
    Loading page…
  </div>
);

const AppShell: React.FC = () => {
  const { isLoggedIn, hasMembership, isAuthLoading, currentRoute, toasts, dismissToast, role, currentUser, activeInstitutionId } = useApp();

  if (isAuthLoading) {
    return <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B', fontSize: '14px' }}>Restoring your session…</div>;
  }

  // No authenticated session or no institution membership: stay outside the demo dashboards.
  if (!isLoggedIn || !hasMembership || currentRoute === 'login' || currentRoute === 'onboarding') {
    return (
      <LazyPageErrorBoundary key="login">
        <Suspense fallback={<PageLoadingFallback />}>
          <LoginPage />
        </Suspense>
      </LazyPageErrorBoundary>
    );
  }

  const teacherRoutes = new Set(['teacher-dashboard', 'teacher-classes', 'teacher-student-detail', 'student-profile', 'attendance-register']);
  const parentRoutes = new Set(['parent-dashboard', 'parent-academic', 'parent-attendance', 'parent-fees']);

  // Active page router
  const renderActivePage = () => {
    if (role === 'teacher' && !teacherRoutes.has(currentRoute)) return <TeacherDashboard />;
    if (role === 'parent' && !parentRoutes.has(currentRoute)) return <ParentDashboard />;
    switch (currentRoute) {
      // Admin Routes
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'student-directory':
        return <StudentDirectory />;
      case 'student-profile':
        return role === 'teacher' ? <TeacherStudentDetailPage /> : <StudentProfilePage />;
      case 'teacher-management':
        return <TeacherManagement />;
      case 'classes-batches':
        return <ClassesBatchesSubjects />;
      case 'academic-calendar':
        return <AcademicCalendarPage />;
      case 'attendance-register':
        return <AttendanceRegisterPage />;
      case 'attendance-reports':
        return <AttendanceReportsPage />;

      // Consolidated School Examinations
      case 'school-exams':
      case 'school-exam-setup':
      case 'school-exam-marks':
      case 'school-results':
        return <SchoolExaminationsPage />;

      // Consolidated Tuition Tests
      case 'tuition-tests':
      case 'tuition-test-setup':
      case 'tuition-test-marks':
      case 'tuition-test-results':
        return <TuitionTestsPage />;

      case 'academic-analytics':
        return <AcademicAnalyticsPage />;

      // Consolidated Individual Student Fees Management
      case 'fees':
      case 'fee-collection':
      case 'fee-structure':
      case 'outstanding-fees':
      case 'payment-history':
      case 'financial-reports':
        return <StudentFeesPage />;

      case 'reports-center':
        return <ReportsCenterPage />;
      case 'user-management':
        return <UserManagementPage />;
      case 'institution-settings':
        return role === 'admin' ? (
          <InstitutionSettingsPage />
        ) : role === 'teacher' ? (
          <TeacherDashboard />
        ) : (
          <ParentDashboard />
        );

      // Teacher Routes
      case 'teacher-dashboard':
        return <TeacherDashboard />;
      case 'teacher-classes':
        return <TeacherClassesPage />;
      case 'teacher-student-detail':
        return <TeacherStudentDetailPage />;

      // Parent Routes
      case 'parent-dashboard':
        return <ParentDashboard />;
      case 'parent-academic':
        return <ParentAcademicProgress />;
      case 'parent-attendance':
        return <ParentAttendancePage />;
      case 'parent-fees':
        return <ParentFeesPage />;

      default:
        // Role-based fallback
        if (role === 'admin') return <AdminDashboard />;
        if (role === 'teacher') return <TeacherDashboard />;
        if (role === 'parent') return <ParentDashboard />;
        return <AdminDashboard />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main App Content Area */}
      <div className="main-wrapper">
        <Header />
        <main className="main-content" key={`${currentUser.id}:${activeInstitutionId}:${role}`}>
          <LazyPageErrorBoundary key={currentRoute}>
            <Suspense fallback={<PageLoadingFallback />}>
              {renderActivePage()}
            </Suspense>
          </LazyPageErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Global Toast Notifications Stack */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.type === 'success' && <CheckCircle2 size={16} color="#10B981" />}
              {toast.type === 'error' && <AlertCircle size={16} color="#EF4444" />}
              {toast.type === 'warning' && <AlertCircle size={16} color="#F59E0B" />}
              {toast.type === 'info' && <Info size={16} color="#6366F1" />}
              <span style={{ flex: 1, fontSize: '13px', color: '#1E293B', fontWeight: 500 }}>
                {toast.message}
              </span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    dismissToast(toast.id);
                    toast.action?.onClick();
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    borderRadius: '5px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    cursor: 'pointer',
                    marginRight: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                className="btn-icon"
                onClick={() => dismissToast(toast.id)}
                style={{ width: '20px', height: '20px', padding: 0 }}
              >
                <X size={13} color="#94A3B8" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <PwaControls />
      <AppShell />
    </AppProvider>
  );
}

export default App;

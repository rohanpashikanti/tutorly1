import React, { useState } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileSpreadsheet,
  Award,
  BarChart3,
  CreditCard,
  FileText,
  ShieldCheck,
  Settings,
  ChevronDown,
  Search,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredStudents, getStoredTeachers } from '../../utils/storage';

export const Sidebar: React.FC = () => {
  const { role, currentRoute, navigateTo, memberships, activeInstitutionId, setActiveInstitutionId } = useApp();
  const studentCount = getStoredStudents().length;
  const teacherCount = getStoredTeachers().length;
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    attendance: true,
    schoolExams: false,
    tuitionTests: false,
    fees: true,
  });

  const toggleSubmenu = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="sidebar">
      {/* Brand & Institution Switcher */}
      <div className="sidebar-header">
        <div className="brand-logo" onClick={() => navigateTo(role === 'admin' ? 'admin-dashboard' : role === 'teacher' ? 'teacher-dashboard' : 'parent-dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon-wrap">
            <GraduationCap size={20} />
          </div>
          <span className="brand-title">Tutorly</span>
        </div>

        <label className="institution-switcher" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} color="#6366F1" />
          <select aria-label="Active institution" value={activeInstitutionId} onChange={(event) => {
            if (event.target.value === '__create-institution__') navigateTo('onboarding');
            else setActiveInstitutionId(event.target.value);
          }} style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: 'transparent', color: 'inherit', font: 'inherit' }}>
            {memberships.map((membership) => <option key={membership.institutionId} value={membership.institutionId}>{membership.institutionName}</option>)}
            <option value="__create-institution__">Create institution…</option>
          </select>
          {memberships.length > 1 && <ChevronDown size={14} color="#94A3B8" />}
        </label>
      </div>

      {/* Global Quick Search */}
      <div className="sidebar-search">
        <Search size={14} className="search-icon" />
        <input type="text" placeholder="Search..." />
      </div>

      {/* Role-Specific Navigation */}
      <div className="sidebar-nav">
        {role === 'admin' && (
          <>
            <div className="nav-group-title">Main Menu</div>
            <button
              className={`nav-item ${currentRoute === 'admin-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('admin-dashboard')}
              title="Dashboard"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'student-directory' || currentRoute === 'student-profile' ? 'active' : ''}`}
              onClick={() => navigateTo('student-directory')}
              title="Students Directory"
            >
              <Users size={18} />
              <span>Students</span>
              {studentCount > 0 && <span className="nav-badge">{studentCount}</span>}
            </button>

            <button
              className={`nav-item ${currentRoute === 'teacher-management' ? 'active' : ''}`}
              onClick={() => navigateTo('teacher-management')}
              title="Teachers Directory"
            >
              <UserCheck size={18} />
              <span>Teachers</span>
              {teacherCount > 0 && <span className="nav-badge">{teacherCount}</span>}
            </button>

            <button
              className={`nav-item ${currentRoute === 'classes-batches' ? 'active' : ''}`}
              onClick={() => navigateTo('classes-batches')}
              title="Classes & Batches"
            >
              <Layers size={18} />
              <span>Classes & Batches</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'academic-calendar' ? 'active' : ''}`}
              onClick={() => navigateTo('academic-calendar')}
              title="Academic Calendar"
            >
              <Calendar size={18} />
              <span>Academic Calendar</span>
            </button>

            <div className="nav-group-title">Assessments & Activity</div>
            {/* Attendance & Submenu */}
            <div>
              <button
                className={`nav-item ${currentRoute === 'attendance-register' || currentRoute === 'attendance-reports' ? 'active' : ''}`}
                onClick={() => navigateTo('attendance-register')}
                title="Attendance"
              >
                <ClipboardCheck size={18} />
                <span style={{ flex: 1, textAlign: 'left' }}>Attendance</span>
                <span onClick={(e) => toggleSubmenu('attendance', e)} style={{ padding: '2px' }}>
                  {openSubmenus.attendance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>
              {openSubmenus.attendance && (
                <div className="sidebar-submenu" style={{ paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                  <button
                    className={`nav-item ${currentRoute === 'attendance-register' ? 'active' : ''}`}
                    onClick={() => navigateTo('attendance-register')}
                    style={{ fontSize: '12.5px', padding: '6px 12px' }}
                    title="Attendance Register"
                  >
                    <span>Register</span>
                  </button>
                  <button
                    className={`nav-item ${currentRoute === 'attendance-reports' ? 'active' : ''}`}
                    onClick={() => navigateTo('attendance-reports')}
                    style={{ fontSize: '12.5px', padding: '6px 12px' }}
                    title="Attendance Reports"
                  >
                    <span>Reports</span>
                  </button>
                </div>
              )}
            </div>

            {/* School Examinations - Consolidated */}
            <button
              className={`nav-item ${['school-exams', 'school-exam-marks', 'school-results'].includes(currentRoute) ? 'active' : ''}`}
              onClick={() => navigateTo('school-exams')}
              title="School Examinations"
            >
              <FileSpreadsheet size={18} />
              <span>School Examinations</span>
            </button>

            {/* Tuition Tests - Consolidated */}
            <button
              className={`nav-item ${['tuition-tests', 'tuition-test-marks', 'tuition-test-results'].includes(currentRoute) ? 'active' : ''}`}
              onClick={() => navigateTo('tuition-tests')}
              title="Tuition Tests"
            >
              <Award size={18} />
              <span>Tuition Tests</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'academic-analytics' ? 'active' : ''}`}
              onClick={() => navigateTo('academic-analytics')}
              title="Academic Analytics"
            >
              <BarChart3 size={18} />
              <span>Academic Analytics</span>
            </button>

            <div className="nav-group-title">Finance & Center Ops</div>
            {/* Fees - Simplified Single Module */}
            <button
              className={`nav-item ${['fees', 'fee-collection', 'fee-structure', 'outstanding-fees', 'payment-history', 'financial-reports'].includes(currentRoute) ? 'active' : ''}`}
              onClick={() => navigateTo('fee-collection')}
              title="Fees"
            >
              <CreditCard size={18} />
              <span>Fees</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'reports-center' ? 'active' : ''}`}
              onClick={() => navigateTo('reports-center')}
              title="Reports"
            >
              <FileText size={18} />
              <span>Reports</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'user-management' ? 'active' : ''}`}
              onClick={() => navigateTo('user-management')}
              title="Users & Permissions"
            >
              <ShieldCheck size={18} />
              <span>Users & Permissions</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'institution-settings' ? 'active' : ''}`}
              onClick={() => navigateTo('institution-settings')}
              title="Settings"
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </>
        )}

        {role === 'teacher' && (
          <>
            <div className="nav-group-title">Teacher Portal</div>
            <button
              className={`nav-item ${currentRoute === 'teacher-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('teacher-dashboard')}
              title="Dashboard"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'teacher-classes' ? 'active' : ''}`}
              onClick={() => navigateTo('teacher-classes')}
              title="My Classes & Batches"
            >
              <BookOpen size={18} />
              <span>My Classes & Batches</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'attendance-register' ? 'active' : ''}`}
              onClick={() => navigateTo('attendance-register')}
              title="Mark Attendance"
            >
              <ClipboardCheck size={18} />
              <span>Mark Attendance</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'tuition-tests' || currentRoute === 'tuition-test-marks' ? 'active' : ''}`}
              onClick={() => navigateTo('tuition-tests')}
              title="Tuition Tests"
            >
              <Award size={18} />
              <span>Tuition Tests</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'school-exams' || currentRoute === 'school-exam-marks' ? 'active' : ''}`}
              onClick={() => navigateTo('school-exams')}
              title="School Exams"
            >
              <FileSpreadsheet size={18} />
              <span>School Exams</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'academic-calendar' ? 'active' : ''}`}
              onClick={() => navigateTo('academic-calendar')}
              title="Academic Calendar"
            >
              <Calendar size={18} />
              <span>Academic Calendar</span>
            </button>
          </>
        )}

        {role === 'parent' && (
          <>
            <div className="nav-group-title">Parent Portal</div>
            <button
              className={`nav-item ${currentRoute === 'parent-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-dashboard')}
              title="Dashboard"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'parent-academic' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-academic')}
              title="Academic Progress"
            >
              <Award size={18} />
              <span>Academic Progress</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'parent-attendance' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-attendance')}
              title="Attendance"
            >
              <ClipboardCheck size={18} />
              <span>Attendance</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'parent-fees' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-fees')}
              title="Fees & Receipts"
            >
              <CreditCard size={18} />
              <span>Fees & Receipts</span>
            </button>

            <button
              className={`nav-item ${currentRoute === 'academic-calendar' ? 'active' : ''}`}
              onClick={() => navigateTo('academic-calendar')}
              title="Academic Calendar"
            >
              <Calendar size={18} />
              <span>Academic Calendar</span>
            </button>
          </>
        )}
      </div>

      {/* The active role comes from the server-validated institution membership. */}
      <div className="sidebar-footer">
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Signed in as {role}</div>
      </div>
    </aside>
  );
};

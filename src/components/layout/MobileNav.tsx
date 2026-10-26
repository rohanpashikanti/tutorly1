import React, { useState } from 'react';
import {
  Home,
  Users,
  ClipboardCheck,
  Award,
  CreditCard,
  Menu,
  X,
  Layers,
  Settings,
  Megaphone,
  FileText,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileNav: React.FC = () => {
  const { role, currentRoute, navigateTo, logout } = useApp();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      <nav className="mobile-bottom-nav">
        {role === 'admin' && (
          <>
            <button
              className={`mobile-nav-item ${currentRoute === 'admin-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('admin-dashboard')}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'student-directory' ? 'active' : ''}`}
              onClick={() => navigateTo('student-directory')}
            >
              <Users size={20} />
              <span>Students</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'attendance-register' ? 'active' : ''}`}
              onClick={() => navigateTo('attendance-register')}
            >
              <ClipboardCheck size={20} />
              <span>Attendance</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'tuition-tests' ? 'active' : ''}`}
              onClick={() => navigateTo('tuition-tests')}
            >
              <Award size={20} />
              <span>Tests</span>
            </button>
            <button
              className={`mobile-nav-item ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(true)}
            >
              <Menu size={20} />
              <span>More</span>
            </button>
          </>
        )}

        {role === 'teacher' && (
          <>
            <button
              className={`mobile-nav-item ${currentRoute === 'teacher-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('teacher-dashboard')}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'teacher-classes' ? 'active' : ''}`}
              onClick={() => navigateTo('teacher-classes')}
            >
              <Users size={20} />
              <span>Classes</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'attendance-register' ? 'active' : ''}`}
              onClick={() => navigateTo('attendance-register')}
            >
              <ClipboardCheck size={20} />
              <span>Attendance</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'tuition-test-marks' ? 'active' : ''}`}
              onClick={() => navigateTo('tuition-test-marks')}
            >
              <Award size={20} />
              <span>Marks</span>
            </button>
            <button
              className={`mobile-nav-item ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(true)}
            >
              <Menu size={20} />
              <span>More</span>
            </button>
          </>
        )}

        {role === 'parent' && (
          <>
            <button
              className={`mobile-nav-item ${currentRoute === 'parent-dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-dashboard')}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'parent-academic' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-academic')}
            >
              <Award size={20} />
              <span>Progress</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'parent-attendance' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-attendance')}
            >
              <ClipboardCheck size={20} />
              <span>Attendance</span>
            </button>
            <button
              className={`mobile-nav-item ${currentRoute === 'parent-fees' ? 'active' : ''}`}
              onClick={() => navigateTo('parent-fees')}
            >
              <CreditCard size={20} />
              <span>Fees</span>
            </button>
            <button
              className={`mobile-nav-item ${showMoreMenu ? 'active' : ''}`}
              onClick={() => setShowMoreMenu(true)}
            >
              <Menu size={20} />
              <span>More</span>
            </button>
          </>
        )}
      </nav>

      {/* More Slide-over Drawer for Mobile */}
      {showMoreMenu && (
        <div className="slide-over-backdrop" onClick={() => setShowMoreMenu(false)}>
          <div className="slide-over-panel mobile-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Navigation Menu</span>
                <span className="badge badge-purple" style={{ textTransform: 'uppercase', fontSize: '10px' }}>{role}</span>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                style={{ padding: '6px', borderRadius: '6px', background: '#F1F5F9' }}
                aria-label="Close menu"
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
              {role === 'admin' && (
                <>
                  <div className="nav-group-title" style={{ padding: '6px 10px 4px', fontSize: '11px' }}>Core Management</div>
                  <button className="nav-item" onClick={() => { navigateTo('student-directory'); setShowMoreMenu(false); }}>
                    <Users size={18} />
                    <span>Students Directory</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('teacher-management'); setShowMoreMenu(false); }}>
                    <Users size={18} />
                    <span>Teachers Directory</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('classes-batches'); setShowMoreMenu(false); }}>
                    <Layers size={18} />
                    <span>Classes & Batches</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('academic-calendar'); setShowMoreMenu(false); }}>
                    <Calendar size={18} />
                    <span>Academic Calendar</span>
                  </button>

                  <div className="nav-group-title" style={{ padding: '12px 10px 4px', fontSize: '11px' }}>Academics & Tests</div>
                  <button className="nav-item" onClick={() => { navigateTo('attendance-register'); setShowMoreMenu(false); }}>
                    <ClipboardCheck size={18} />
                    <span>Attendance Register</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('attendance-reports'); setShowMoreMenu(false); }}>
                    <FileText size={18} />
                    <span>Attendance Reports</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('school-exams'); setShowMoreMenu(false); }}>
                    <FileText size={18} />
                    <span>School Examinations</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('tuition-tests'); setShowMoreMenu(false); }}>
                    <Award size={18} />
                    <span>Tuition Tests</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('academic-analytics'); setShowMoreMenu(false); }}>
                    <FileText size={18} />
                    <span>Academic Analytics</span>
                  </button>

                  <div className="nav-group-title" style={{ padding: '12px 10px 4px', fontSize: '11px' }}>Finance & Center</div>
                  <button className="nav-item" onClick={() => { navigateTo('fee-collection'); setShowMoreMenu(false); }}>
                    <CreditCard size={18} />
                    <span>Student Fees</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('reports-center'); setShowMoreMenu(false); }}>
                    <FileText size={18} />
                    <span>Reports Center</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('user-management'); setShowMoreMenu(false); }}>
                    <ShieldCheck size={18} />
                    <span>Users & Permissions</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('institution-settings'); setShowMoreMenu(false); }}>
                    <Settings size={18} />
                    <span>Institution Settings</span>
                  </button>
                </>
              )}

              {role === 'teacher' && (
                <>
                  <div className="nav-group-title" style={{ padding: '6px 10px 4px', fontSize: '11px' }}>Teacher Workflows</div>
                  <button className="nav-item" onClick={() => { navigateTo('teacher-classes'); setShowMoreMenu(false); }}>
                    <Layers size={18} />
                    <span>My Classes & Batches</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('attendance-register'); setShowMoreMenu(false); }}>
                    <ClipboardCheck size={18} />
                    <span>Mark Attendance</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('tuition-tests'); setShowMoreMenu(false); }}>
                    <Award size={18} />
                    <span>Tuition Tests</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('school-exams'); setShowMoreMenu(false); }}>
                    <Award size={18} />
                    <span>School Exam Marks</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('academic-calendar'); setShowMoreMenu(false); }}>
                    <Calendar size={18} />
                    <span>Academic Calendar</span>
                  </button>
                </>
              )}

              {role === 'parent' && (
                <>
                  <div className="nav-group-title" style={{ padding: '6px 10px 4px', fontSize: '11px' }}>Parent Options</div>
                  <button className="nav-item" onClick={() => { navigateTo('parent-academic'); setShowMoreMenu(false); }}>
                    <Award size={18} />
                    <span>Academic Progress</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('parent-attendance'); setShowMoreMenu(false); }}>
                    <ClipboardCheck size={18} />
                    <span>Attendance Records</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('parent-fees'); setShowMoreMenu(false); }}>
                    <CreditCard size={18} />
                    <span>Fees & Receipts</span>
                  </button>
                  <button className="nav-item" onClick={() => { navigateTo('academic-calendar'); setShowMoreMenu(false); }}>
                    <Calendar size={18} />
                    <span>Academic Calendar</span>
                  </button>
                </>
              )}

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 16px))' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', color: '#EF4444', borderColor: '#FECACA', justifyContent: 'center' }}
                  onClick={() => {
                    setShowMoreMenu(false);
                    logout();
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

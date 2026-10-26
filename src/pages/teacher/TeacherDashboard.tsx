import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  Award,
  BookMarked,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getStoredStudents, getStoredTuitionTests } from '../../utils/storage';

export const TeacherDashboard: React.FC = () => {
  const { currentUser, navigateTo, showToast, activeInstitutionId } = useApp();
  const [teacherData, setTeacherData] = React.useState<any>(null);

  React.useEffect(() => {
    api.portals.getTeacher(activeInstitutionId).then((res) => {
      if (res) {
        setTeacherData(res);
      }
    }).catch(() => {});
  }, [activeInstitutionId]);

  return (
    <div className="page-container">
      {/* Welcome Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Teacher Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Dashboard</span>
          </div>
          <h1>Welcome back, {currentUser.name}!</h1>
          <p className="page-subtitle">
            Here is your daily tuition schedule, assigned batch metrics, and upcoming test workflows.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigateTo('attendance-register')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ClipboardCheck size={16} />
            <span>Mark Attendance</span>
          </button>
        </div>
      </div>

      {/* 4 Square-Style Metric Cards */}
      {/* 4 Square-Style Metric Cards */}
      <div className="teacher-kpi-grid">
        <div className="teacher-kpi-card">
          <div className="teacher-kpi-top">
            <span className="teacher-kpi-label">Assigned Students</span>
            <div className="teacher-kpi-icon" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="teacher-kpi-body">
            <div className="teacher-kpi-value">{teacherData?.totalAssignedStudents ?? 0}</div>
            <div className="teacher-kpi-subtext">Across assigned cohorts</div>
          </div>
        </div>

        <div className="teacher-kpi-card">
          <div className="teacher-kpi-top">
            <span className="teacher-kpi-label">Assigned Cohorts</span>
            <div className="teacher-kpi-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="teacher-kpi-body">
            <div className="teacher-kpi-value">{teacherData?.assignedBatches?.length ?? 0} Batches</div>
            <div className="teacher-kpi-subtext">Active teaching assignments</div>
          </div>
        </div>

        <div className="teacher-kpi-card">
          <div className="teacher-kpi-top">
            <span className="teacher-kpi-label">Batch Average Score</span>
            <div className="teacher-kpi-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <Award size={20} />
            </div>
          </div>
          <div className="teacher-kpi-body">
            <div className="teacher-kpi-value">{teacherData?.batchAverageScore ? `${teacherData.batchAverageScore}%` : '—'}</div>
            <div className="teacher-kpi-subtext" style={{ color: '#64748B' }}>
              Assessment performance
            </div>
          </div>
        </div>

        <div className="teacher-kpi-card">
          <div className="teacher-kpi-top">
            <span className="teacher-kpi-label">Average Attendance</span>
            <div className="teacher-kpi-icon" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div className="teacher-kpi-body">
            <div className="teacher-kpi-value">{teacherData?.averageAttendance ? `${teacherData.averageAttendance}%` : '—'}</div>
            <div className="teacher-kpi-subtext">Across assigned cohorts</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule (Left) + Quick Actions & Alerts (Right) */}
      <div className="grid-split-balanced">
        {/* Left Column: Today's Schedule & Assigned Batches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Today's Schedule */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#6366F1" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Assigned Teaching Batches</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!teacherData?.assignedBatches || teacherData.assignedBatches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px', fontSize: '13px' }}>
                  No teaching classes or cohorts currently assigned.
                </div>
              ) : (
                teacherData.assignedBatches.map((b: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                        {b.class_name} {b.batch_name ? `• ${b.batch_name}` : ''} · <span style={{ color: '#6366F1' }}>{b.subject_name}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Enrolled Students: {b.student_count || 0}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12.5px' }}
                      onClick={() => navigateTo('attendance-register')}
                    >
                      Mark Attendance
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts to Assessment Workflows */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0' }}>Authorized Workflows</h3>
            <div className="grid-2-col" style={{ gap: '12px', marginBottom: 0 }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => navigateTo('tuition-test-marks')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#6366F1' }}>
                    <Award size={18} />
                  </div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>Tuition Test Marks</div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  Enter and publish center weekly/monthly test scores.
                </p>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => navigateTo('school-exam-marks')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#10B981' }}>
                    <FileSpreadsheet size={18} />
                  </div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>School Exam Marks</div>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  Record CBSE/State board term examination scores.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Students Needing Attention + Homework Reviews */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Students Needing Attention */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={18} color="#F59E0B" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Students Needing Attention</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const storedStudents = getStoredStudents();
                const flagged = storedStudents.filter(s => s.status === 'Needs Attention' || (s.attendanceRate > 0 && s.attendanceRate < 80));
                if (flagged.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px', fontSize: '12.5px' }}>
                      No students currently flagged for academic or attendance concerns.
                    </div>
                  );
                }
                return flagged.map((stu) => (
                  <div
                    key={stu.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #FDE68A'
                    }}
                  >
                    <img
                      src={stu.avatar}
                      alt={stu.name}
                      style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
                        {stu.name} <span style={{ fontSize: '11px', fontWeight: 500 }}>({stu.class})</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#B45309' }}>
                        {stu.attendanceRate > 0 ? `Attendance at ${stu.attendanceRate}%` : 'Attendance / Academic attention needed'}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Upcoming Tests & Academic Tasks */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Upcoming Academic Tests</h3>
              </div>
              <button
                className="btn-link"
                style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => navigateTo('tuition-tests')}
              >
                View Tests →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                const storedTests = getStoredTuitionTests();
                if (storedTests.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px', fontSize: '12.5px' }}>
                      No upcoming tuition tests scheduled.
                    </div>
                  );
                }
                return storedTests.slice(0, 3).map((t) => (
                  <div key={t.id} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{t.name}</span>
                      <span className="badge badge-purple">{t.class}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                      Subject: {t.subject} • Max Marks: {t.maxMarks}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

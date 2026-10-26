import React from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  User,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredStudents } from '../../utils/storage';
import { ParentContactActions } from '../../components/common/ParentContactActions';

interface CohortMeta {
  id: string;
  name: string;
  grade: string;
  subject: string;
}

const COHORTS: Record<string, CohortMeta> = {
  'c10-a': {
    id: 'c10-a',
    name: 'Class 10 - Section A',
    grade: 'Grade 10',
    subject: 'Mathematics'
  },
  'c9-b': {
    id: 'c9-b',
    name: 'Class 9 - Section B',
    grade: 'Grade 9',
    subject: 'Science'
  }
};

export const TeacherStudentDetailPage: React.FC = () => {
  const { selectedStudentId, selectedBatchId, currentUser, navigateTo } = useApp();

  const activeCohort = COHORTS[selectedBatchId] || COHORTS['c10-a'];
  const storedStudents = getStoredStudents();
  const student = storedStudents.find((s) => s.id === selectedStudentId);

  // Authorization Check:
  // Teacher is only authorized to view students enrolled in their assigned classes/cohorts.
  const isAuthorized = (() => {
    if (!student) return false;
    if (currentUser.role === 'admin') return true; // Admins have system-wide access
    if (currentUser.role !== 'teacher') return false;

    const teacherClasses = currentUser.assignedClasses || ['Class 10 - A', 'Class 10 - B', 'Class 9 - A'];
    // Check if the student's grade/class matches any assigned teacher classes
    return teacherClasses.some((tc) => {
      if (tc.includes('10') && student.class.includes('10')) return true;
      if (tc.includes('9') && student.class.includes('9')) return true;
      if (tc.includes('8') && student.class.includes('8')) return true;
      return false;
    });
  })();

  const handleReturn = () => {
    navigateTo('teacher-classes', { batchId: selectedBatchId });
  };

  // Not Found State
  if (!student) {
    return (
      <div className="page-container" style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <User size={36} color="#64748B" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>
            No Student Record Selected
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#64748B',
              maxWidth: '520px',
              margin: '0 auto 24px auto',
              lineHeight: 1.6
            }}
          >
            Please select an enrolled student from your class roster to view their detailed performance and profile.
          </p>
          <div>
            <button
              onClick={handleReturn}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontWeight: 600
              }}
            >
              <ArrowLeft size={16} /> Return to {activeCohort.name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unauthorized State
  if (!isAuthorized) {
    return (
      <div className="page-container" style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '1px solid #FECACA',
            backgroundColor: '#FFF5F5'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <ShieldAlert size={36} color="#DC2626" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#991B1B', margin: '0 0 8px 0' }}>
            Access Denied — Unauthorized Student Record
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#7F1D1D',
              maxWidth: '520px',
              margin: '0 auto 24px auto',
              lineHeight: 1.6
            }}
          >
            You are not authorized to view this student's records. Teachers are strictly restricted
            to student records within their assigned classes and batches.
          </p>
          <div>
            <button
              onClick={handleReturn}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontWeight: 600
              }}
            >
              <ArrowLeft size={16} /> Return to {activeCohort.name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const parentName = student.parent?.fatherName || student.parentName || 'Parent / Guardian';
  const parentPhone = student.parent?.phone || student.parentPhone || '+91 98765 43210';
  const subjectScores = student.academic?.subjectScores || {};

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      {/* Back Button & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={handleReturn}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            padding: '7px 14px'
          }}
          title={`Return to ${activeCohort.name}`}
        >
          <ArrowLeft size={15} />
          <span>Back to {activeCohort.name}</span>
        </button>

        <div className="breadcrumb" style={{ margin: 0 }}>
          <span>Teacher Portal</span>
          <span>/</span>
          <span>My Classes</span>
          <span>/</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{student.name}</span>
        </div>
      </div>

      {/* Student Profile Header Card */}
      <div
        className="card"
        style={{
          padding: '24px',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: '1px solid #E2E8F0'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <img
              src={student.avatar}
              alt={student.name}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #EEF2FF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {student.name}
                </h1>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#4F46E5',
                    fontSize: '12.5px',
                    backgroundColor: '#EEF2FF',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  Roll No: {student.rollNo}
                </span>
                <span
                  className={`badge ${
                    student.status === 'Active' ? 'badge-success' : 'badge-warning'
                  }`}
                  style={{ fontSize: '12px', padding: '3px 10px' }}
                >
                  {student.status}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>Adm No: <strong>{student.admissionNo}</strong></span>
                <span>•</span>
                <span>Enrolled: <strong>{student.class}</strong> ({student.batch})</span>
                <span>•</span>
                <span>Active Cohort: <strong>{activeCohort.name}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Academic Badges */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #DCFCE7',
                padding: '10px 16px',
                borderRadius: '10px',
                textAlign: 'center',
                minWidth: '100px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Attendance
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
                {student.attendanceRate}%
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#EEF2FF',
                border: '1px solid #E0E7FF',
                padding: '10px 16px',
                borderRadius: '10px',
                textAlign: 'center',
                minWidth: '100px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#3730A3', textTransform: 'uppercase' }}>
                Tuition Avg
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
                {student.academic?.tuitionTestAvg !== undefined ? `${student.academic.tuitionTestAvg}%` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Detail Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Parent / Guardian Contact Card with Phone & WhatsApp */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <User size={18} color="#4F46E5" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Parent &amp; Guardian Contact
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Father / Guardian Name</div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                {parentName}
              </div>
            </div>

            {student.parent?.motherName && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Mother's Name</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                  {student.parent.motherName}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginBottom: '6px' }}>
                Contact Number &amp; Quick Reach
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                  {parentPhone}
                </span>
                <ParentContactActions
                  phone={parentPhone}
                  parentName={parentName}
                  studentName={student.name}
                  size="sm"
                />
              </div>
            </div>

            {student.parent?.email && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Email Address</div>
                <div style={{ fontSize: '13.5px', color: '#334155', marginTop: '2px' }}>
                  {student.parent.email}
                </div>
              </div>
            )}

            {student.parent?.address && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>Address</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                  {student.parent.address}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Academic Performance */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <Award size={18} color="#4F46E5" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Academic Performance
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>School Exam Avg</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                  {student.academic?.schoolExamAvg !== undefined ? `${student.academic.schoolExamAvg}%` : '—'}
                </div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>Batch Rank</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#4F46E5', marginTop: '3px' }}>
                  {student.academic?.rank !== undefined ? `#${student.academic.rank}` : '—'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Subject Scorecard
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(subjectScores).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                    No subject exam marks entered yet.
                  </div>
                ) : (
                  Object.entries(subjectScores).map(([subject, score]) => (
                    <div key={subject}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                        <span style={{ color: '#475569', fontWeight: 500 }}>{subject}</span>
                        <span style={{ fontWeight: 700, color: (score as number) >= 80 ? '#16A34A' : '#D97706' }}>
                          {score} / 100
                        </span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${score}%`,
                            backgroundColor: (score as number) >= 80 ? '#22C55E' : '#EAB308',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance & Class Participation */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <CalendarCheck size={18} color="#4F46E5" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Attendance Overview
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Cumulative Attendance</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: (student.attendanceRate || 0) >= 85 ? '#15803D' : '#D97706' }}>
                  {student.attendanceRate || 0}%
                </div>
              </div>
              <span className={`badge ${(student.attendanceRate || 0) >= 85 ? 'badge-success' : 'badge-warning'}`}>
                {(student.attendanceRate || 0) >= 85 ? 'Regular' : 'Borderline'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Attendance rate: <strong>{student.attendanceRate || 0}%</strong> recorded for this student.
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigateTo('attendance-register')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Go to Attendance Register
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

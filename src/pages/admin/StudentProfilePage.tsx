import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Edit2,
  CalendarCheck,
  Award,
  BookOpen,
  CreditCard,
  Mail,
  ChevronRight,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  History,
  Download,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { BarChart } from '../../components/charts/Charts';
import { ParentContactActions } from '../../components/common/ParentContactActions';
import { getStoredStudents } from '../../utils/storage';
import { api } from '../../api/client';

export const StudentProfilePage: React.FC = () => {
  const { selectedStudentId, navigateTo, showToast, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<'Overview' | 'Academic' | 'Attendance' | 'Examinations' | 'Tuition Tests' | 'Fees & Payments' | 'History'>('Overview');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [examTypeFilter, setExamTypeFilter] = useState<'School Exams' | 'Tuition Tests'>('School Exams');
  const [promoteYear, setPromoteYear] = useState('Academic Year 2027 - 2028');
  const [promoteClass, setPromoteClass] = useState('');
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!activeInstitutionId) return;
    api.academics.getOverview(activeInstitutionId)
      .then((res) => {
        const cls = res?.classes || [];
        setClassList(cls);
        if (cls.length > 0 && !promoteClass) {
          setPromoteClass(cls[0].name);
        }
      })
      .catch(() => {});
  }, [activeInstitutionId]);

  const [student, setStudent] = useState<Student | null>(() => {
    const list = getStoredStudents();
    return list.find((s) => s.id === selectedStudentId) || null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedStudentId && !student) {
      const stored = getStoredStudents();
      if (stored.length > 0) {
        setStudent(stored[0]);
      }
    }
  }, [selectedStudentId, student]);

  useEffect(() => {
    if (activeInstitutionId && selectedStudentId) {
      setIsLoading(true);
      api.students.get(activeInstitutionId, selectedStudentId)
        .then((res) => {
          if (res && res.student) {
            setStudent(res.student);
          }
        })
        .catch(() => {
          // Keep cached
        })
        .finally(() => setIsLoading(false));
    }
  }, [activeInstitutionId, selectedStudentId]);

  const [editFormData, setEditFormData] = useState({
    name: student?.name || '',
    class: student?.class || '',
    batch: student?.batch || '',
    fatherName: student?.parent?.fatherName || '',
    phone: student?.parent?.phone || '',
    email: student?.parent?.email || '',
  });

  useEffect(() => {
    if (student) {
      setEditFormData({
        name: student.name,
        class: student.class,
        batch: student.batch,
        fatherName: student.parent?.fatherName || '',
        phone: student.parent?.phone || '',
        email: student.parent?.email || '',
      });
    }
  }, [student]);

  if (!student) {
    return (
      <div className="page-wrapper" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
          No Student Selected
        </h2>
        <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto 20px' }}>
          Please select a student from the Student Directory to view their academic and fee profile.
        </p>
        <button className="btn btn-primary" onClick={() => navigateTo('student-directory')}>
          Go to Student Directory
        </button>
      </div>
    );
  }

  const subjectEntries = Object.entries(student.academic?.subjectScores || {});
  const subjectScoresData = subjectEntries.length > 0
    ? subjectEntries.map(([subj, score]) => ({ label: subj, value: Number(score) || 0, color: '#6366F1' }))
    : [];

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudent({
      ...student,
      class: promoteClass,
    });
    setShowPromoteModal(false);
    showToast(`${student.name} promoted to ${promoteClass} for ${promoteYear}.`, 'success');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeInstitutionId) {
        await api.students.update(activeInstitutionId, student.id, {
          name: editFormData.name,
          phone: editFormData.phone,
          email: editFormData.email,
        });
      }
      setStudent({
        ...student,
        name: editFormData.name,
        class: editFormData.class,
        batch: editFormData.batch,
        parent: {
          ...student.parent,
          fatherName: editFormData.fatherName,
          phone: editFormData.phone,
          email: editFormData.email,
        }
      });
      setShowEditModal(false);
      showToast(`Updated profile for ${editFormData.name}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update student', 'error');
    }
  };

  return (
    <div className="page-wrapper">
      {/* Back button & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => navigateTo('student-directory')}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Directory</span>
        </button>
        <div className="breadcrumb-nav" style={{ margin: 0 }}>
          <span>Students</span>
          <span>›</span>
          <span>Student Directory</span>
          <span>›</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{student.name}</span>
        </div>
      </div>

      {/* Top Profile Hero Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img
              src={student.avatar}
              alt={student.name}
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEF2FF', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{student.name}</h1>
                <span className={`badge ${student.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{student.status}</span>
              </div>
              <div style={{ fontSize: '13.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span><strong>{student.admissionNo}</strong></span>
                <span>•</span>
                <span>{student.class} • {student.batch}</span>
                <span>•</span>
                <span>{student.gender} • {student.age} years</span>
                <span>•</span>
                <span>DOB: {student.dob || '—'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
              <Edit2 size={15} />
              <span>Edit</span>
            </button>
            <button className="btn btn-outline" onClick={() => setShowPromoteModal(true)}>
              <UserCheck size={15} />
              <span>Promote / Transfer</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="underline-tabs" style={{ padding: '0 24px', margin: 0, overflowX: 'auto' }}>
          {(['Overview', 'Academic', 'Attendance', 'Examinations', 'Tuition Tests', 'Fees & Payments', 'History'] as const).map((tab) => (
            <div
              key={tab}
              className={`underline-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon green">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Attendance</div>
            <div className="stat-value">{student.attendanceRate}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">{student.attendanceRate > 0 ? `${student.attendanceRate}% attendance record` : 'No attendance recorded'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <FileSpreadsheet size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">School Exam Avg</div>
            <div className="stat-value">{student.academic?.schoolExamAvg || 0}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">School academic results</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Tuition Test Avg</div>
            <div className="stat-value">{student.academic?.tuitionTestAvg || 0}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Internal test evaluations</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon emerald">
            <CreditCard size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Tuition Fee Status</div>
            <div className="stat-value">{student.fees?.status || 'Active'}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Due: ₹{(student.fees?.pendingAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab: 1. Overview */}
      {activeTab === 'Overview' && (
        <div className="grid-split">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Subject Performance */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Subject Performance</div>
                <select
                  className="select-field"
                  style={{ fontSize: '12px' }}
                  value={examTypeFilter}
                  onChange={(e) => setExamTypeFilter(e.target.value as any)}
                >
                  <option value="School Exams">School Exams</option>
                  <option value="Tuition Tests">Tuition Tests</option>
                </select>
              </div>
              <div className="card-body">
                {subjectScoresData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '13px' }}>
                    No subject examination scores entered yet for this student.
                  </div>
                ) : (
                  <BarChart
                    data={subjectScoresData}
                    height={160}
                    valueFormatter={(v) => `${v}%`}
                  />
                )}
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Attendance Status</div>
                <button
                  onClick={() => setActiveTab('Attendance')}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}
                >
                  View Details →
                </button>
              </div>
              <div className="card-body" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: student.attendanceRate >= 85 ? '#10B981' : '#F59E0B' }}>
                  {student.attendanceRate}%
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>
                  {student.attendanceRate > 0 ? 'Regular Attendance Rate' : 'No attendance sessions logged for this cohort'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parent Info & Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Parent Info Card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Parent / Guardian</div>
                <button onClick={() => setShowEditModal(true)} style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600 }}>Edit</button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{student.parent?.fatherName || 'Not specified'}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Primary Guardian</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <ParentContactActions
                      phone={student.parent?.phone || ''}
                      parentName={student.parent?.fatherName || ''}
                      studentName={student.name}
                      size="sm"
                      showNumber={true}
                    />
                  </div>
                  {student.parent?.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} color="#6366F1" />
                      <span>{student.parent.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fee Status Card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Fee Status</div>
                <button onClick={() => setActiveTab('Fees & Payments')} style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600 }}>View All →</button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Total Annual Fee</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>₹{(student.fees?.totalFee || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <span className={`badge ${student.fees?.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{student.fees?.status || 'Active'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Pending Due</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#EF4444' }}>₹{(student.fees?.pendingAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Due: {student.fees?.nextDue || '—'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Quick Actions</div>
              </div>
              <div className="card-body quick-actions-grid" style={{ padding: '16px' }}>
                <button
                  onClick={() => navigateTo('attendance-register')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                >
                  <CalendarCheck size={18} color="#6366F1" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' }}>Mark Attendance</span>
                </button>
                <button
                  onClick={() => navigateTo('tuition-test-marks')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                >
                  <Award size={18} color="#10B981" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' }}>Add Test Marks</span>
                </button>
                <button
                  onClick={() => navigateTo('fee-collection')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                >
                  <CreditCard size={18} color="#F59E0B" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' }}>Record Payment</span>
                </button>
                <button
                  onClick={() => navigateTo('reports-center')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                >
                  <FileText size={18} color="#3B82F6" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' }}>Generate Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 2. Academic */}
      {activeTab === 'Academic' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Academic Progress & Scores</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Subject breakdown for {student.class}.</p>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Current Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subjectEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No subject scores recorded yet for this student.
                    </td>
                  </tr>
                ) : (
                  subjectEntries.map(([subj, score]) => (
                    <tr key={subj}>
                      <td style={{ fontWeight: 700 }}>{subj}</td>
                      <td><span className="badge badge-success">{score}%</span></td>
                      <td><span className="badge badge-success">Recorded</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 3. Attendance */}
      {activeTab === 'Attendance' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Attendance Record</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Overall attendance rate: {student.attendanceRate}%</p>
          </div>
          <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
            {student.attendanceRate > 0 ? (
              <div>Current attendance rate is {student.attendanceRate}%. Daily session logs are recorded in the central Attendance Register.</div>
            ) : (
              <div>No attendance session entries recorded yet for this student.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab: 4. Examinations */}
      {activeTab === 'Examinations' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>School Examination Results</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>School examination records and term report cards.</p>
          </div>
          <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
            No school examination entries recorded yet for this student.
          </div>
        </div>
      )}

      {/* Tab: 5. Tuition Tests */}
      {activeTab === 'Tuition Tests' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Tuition Internal Tests</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Internal evaluations conducted in Tutorly.</p>
          </div>
          <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
            No internal tuition tests recorded yet for this student.
          </div>
        </div>
      )}

      {/* Tab: 6. Fees & Payments */}
      {activeTab === 'Fees & Payments' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Fee Ledger & Payment Receipts</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Assigned fee breakdown and payment status.</p>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fee Head</th>
                  <th>Total Amount</th>
                  <th>Paid</th>
                  <th>Pending</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!student.fees || student.fees.totalFee === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No fee records or payment transactions found for this student.
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td style={{ fontWeight: 700 }}>Annual Tuition Fee</td>
                    <td>₹{student.fees.totalFee.toLocaleString('en-IN')}</td>
                    <td style={{ color: '#10B981', fontWeight: 600 }}>₹{student.fees.paidAmount.toLocaleString('en-IN')}</td>
                    <td style={{ color: '#EF4444', fontWeight: 700 }}>₹{student.fees.pendingAmount.toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${student.fees.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{student.fees.status}</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 7. History */}
      {activeTab === 'History' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Student Lifecycle & History</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Enrollment record and academic milestones.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid #E2E8F0', paddingLeft: '20px', marginLeft: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366F1' }}>{student.admissionDate || 'Enrolled'}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Enrolled into {student.class} ({student.batch})</div>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>Admission No {student.admissionNo} issued. Parent {student.parent?.fatherName || 'Guardian'} registered.</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Student Profile — {student.name}</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class</label>
                    <input
                      type="text"
                      value={editFormData.class}
                      disabled
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F1F5F9' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <input
                      type="text"
                      value={editFormData.batch}
                      disabled
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F1F5F9' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.fatherName}
                      onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Phone *</label>
                    <input
                      type="tel"
                      required
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote / Transfer Modal */}
      {showPromoteModal && (
        <div className="modal-backdrop" onClick={() => setShowPromoteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Promote or Transfer Student</h2>
              <button onClick={() => setShowPromoteModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handlePromoteSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#EEF2FF', borderRadius: '10px', fontSize: '12.5px', color: '#4338CA', lineHeight: 1.4 }}>
                  <strong>Academic Continuity Notice:</strong> Promoting {student.name} will maintain their record permanently in their history.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Target Academic Year</label>
                  <select
                    className="select-field"
                    style={{ width: '100%' }}
                    value={promoteYear}
                    onChange={(e) => setPromoteYear(e.target.value)}
                  >
                    <option>Academic Year 2027 - 2028</option>
                    <option>Academic Year 2026 - 2027</option>
                  </select>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Promote to Class</label>
                    <select
                      className="select-field"
                      style={{ width: '100%' }}
                      value={promoteClass}
                      onChange={(e) => setPromoteClass(e.target.value)}
                    >
                      {classList.length === 0 ? (
                        <option value="">No classes configured</option>
                      ) : (
                        classList.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Promotion</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

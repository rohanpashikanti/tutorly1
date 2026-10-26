import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit2,
  CalendarCheck,
  Award,
  BookOpen,
  CreditCard,
  Phone,
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
  Calendar,
  Layers,
  Clock,
  Printer
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOCK_STUDENTS } from '../../data/mockData';
import { BarChart } from '../../components/charts/Charts';
import { downloadCSV, downloadSampleDocument, triggerPrint } from '../../utils/demoActions';
import { ParentContactActions } from '../../components/common/ParentContactActions';

export const StudentProfilePage: React.FC = () => {
  const { selectedStudentId, navigateTo, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'Overview' | 'Academic' | 'Attendance' | 'Examinations' | 'Tuition Tests' | 'Homework' | 'Fees & Payments' | 'Documents' | 'History'>('Overview');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [examTypeFilter, setExamTypeFilter] = useState<'School Exams' | 'Tuition Tests'>('School Exams');
  const [promoteYear, setPromoteYear] = useState('Academic Year 2027 - 2028');
  const [promoteClass, setPromoteClass] = useState('Class 11');

  const initialStudent = MOCK_STUDENTS.find((s) => s.id === selectedStudentId) || MOCK_STUDENTS[0];
  const [student, setStudent] = useState(initialStudent);

  const [editFormData, setEditFormData] = useState({
    name: student.name,
    class: student.class,
    batch: student.batch,
    fatherName: student.parent.fatherName,
    phone: student.parent.phone,
    email: student.parent.email,
  });

  const subjectScoresData = examTypeFilter === 'School Exams'
    ? [
        { label: 'Maths', value: student.academic.subjectScores.Mathematics || 85, color: '#6366F1' },
        { label: 'Science', value: student.academic.subjectScores.Science || 78, color: '#6366F1' },
        { label: 'English', value: student.academic.subjectScores.English || 72, color: '#6366F1' },
        { label: 'Social', value: student.academic.subjectScores['Social Studies'] || 80, color: '#6366F1' },
        { label: 'Telugu', value: student.academic.subjectScores.Telugu || 90, color: '#6366F1' },
      ]
    : [
        { label: 'Maths', value: 92, color: '#8B5CF6' },
        { label: 'Science', value: 85, color: '#8B5CF6' },
        { label: 'English', value: 88, color: '#8B5CF6' },
        { label: 'Social', value: 84, color: '#8B5CF6' },
        { label: 'Telugu', value: 94, color: '#8B5CF6' },
      ];

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudent({
      ...student,
      class: promoteClass,
    });
    setShowPromoteModal(false);
    showToast(`${student.name} promoted to ${promoteClass} for ${promoteYear}. Academic records linked.`, 'success');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
                <span className="badge badge-success">{student.status}</span>
              </div>
              <div style={{ fontSize: '13.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span><strong>{student.admissionNo}</strong></span>
                <span>•</span>
                <span>{student.class} • {student.batch}</span>
                <span>•</span>
                <span>{student.gender} • {student.age} years</span>
                <span>•</span>
                <span>DOB: {student.dob}</span>
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
              <span className="stat-subtext">228 Present | 20 Absent</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <FileSpreadsheet size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">School Exam Avg</div>
            <div className="stat-value">{student.academic.schoolExamAvg}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Last Term</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Tuition Test Avg</div>
            <div className="stat-value">{student.academic.tuitionTestAvg}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Last 5 Tests</span>
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
              <span className="stat-subtext">Due: ₹{student.fees?.pendingAmount?.toLocaleString('en-IN') || '0'}</span>
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
                  <option value="School Exams">School Exams (Last Term)</option>
                  <option value="Tuition Tests">Tuition Tests (Recent)</option>
                </select>
              </div>
              <div className="card-body">
                <BarChart
                  data={subjectScoresData}
                  height={160}
                  valueFormatter={(v) => `${v}%`}
                />
              </div>
            </div>

            {/* Recent Examinations Table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Examinations</div>
                <button
                  onClick={() => setActiveTab('Examinations')}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}
                >
                  View All →
                </button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Half Yearly</td>
                      <td><span className="badge badge-info">School Exam</span></td>
                      <td style={{ color: '#64748B' }}>10 Oct 2026</td>
                      <td><span className="badge badge-success">78%</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Unit Test 2</td>
                      <td><span className="badge badge-info">School Exam</span></td>
                      <td style={{ color: '#64748B' }}>25 Aug 2026</td>
                      <td><span className="badge badge-success">82%</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Monthly Test</td>
                      <td><span className="badge badge-purple">Tuition Test</span></td>
                      <td style={{ color: '#64748B' }}>05 Aug 2026</td>
                      <td><span className="badge badge-success">88%</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Chapter Test 1</td>
                      <td><span className="badge badge-purple">Tuition Test</span></td>
                      <td style={{ color: '#64748B' }}>12 Jul 2026</td>
                      <td><span className="badge badge-success">76%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Attendance Day Bubbles */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Recent Attendance</div>
                <button
                  onClick={() => setActiveTab('Attendance')}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}
                >
                  View All →
                </button>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Mon 13 Oct</div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Tue 14 Oct</div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Wed 15 Oct</div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>A</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Thu 16 Oct</div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Fri 17 Oct</div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>P</div>
                  </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80"
                    alt="Father"
                    style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{student.parent.fatherName}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Father / Primary Guardian</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <ParentContactActions
                      phone={student.parent.phone}
                      parentName={student.parent.fatherName}
                      studentName={student.name}
                      size="sm"
                      showNumber={true}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={14} color="#6366F1" />
                    <span>{student.parent.email}</span>
                  </div>
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
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Total Due (Oct 2026)</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>₹3,000</div>
                  </div>
                  <span className="badge badge-success">Paid</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Next Due (Nov 2026)</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>₹3,000</div>
                  </div>
                  <span className="badge badge-warning">Pending</span>
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
                  onClick={() => navigateTo('school-exams')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}
                >
                  <FileSpreadsheet size={18} color="#6366F1" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', textAlign: 'center' }}>School Exams</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Academic Progress & Syllabus Status</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Comprehensive breakdown of scores and syllabus coverage for {student.class}.</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadSampleDocument(`Academic_Summary_${student.admissionNo}.pdf`, `ACADEMIC PROGRESS SUMMARY\nStudent: ${student.name}\nClass: ${student.class} - ${student.batch}\nAdmission No: ${student.admissionNo}\nOverall Avg: ${student.academic.schoolExamAvg}%\nGenerated on: 25 Oct 2026`)}
            >
              <Download size={14} />
              <span>Download Academic Summary</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Current Score</th>
                  <th>Syllabus Covered</th>
                  <th>Remarks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Mathematics</td>
                  <td><span className="badge badge-success">85%</span></td>
                  <td>80% (12 of 15 Chapters)</td>
                  <td>Consistently strong in Algebra, needs practice in Geometry proofs.</td>
                  <td><span className="badge badge-success">On Track</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Science</td>
                  <td><span className="badge badge-success">78%</span></td>
                  <td>75% (9 of 12 Chapters)</td>
                  <td>Active participation in practical lab experiments.</td>
                  <td><span className="badge badge-success">On Track</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>English</td>
                  <td><span className="badge badge-warning">72%</span></td>
                  <td>85% (11 of 13 Chapters)</td>
                  <td>Good grammar skills; needs attention in reading comprehension.</td>
                  <td><span className="badge badge-warning">Needs Focus</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Social Studies</td>
                  <td><span className="badge badge-success">80%</span></td>
                  <td>70% (14 of 20 Chapters)</td>
                  <td>Good historical recall and map plotting.</td>
                  <td><span className="badge badge-success">On Track</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 3. Attendance */}
      {activeTab === 'Attendance' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Attendance Register & Logs</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Total working days: 248 | Present: 228 | Absent: 20 | Attendance rate: {student.attendanceRate}%</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCSV(`Attendance_${student.admissionNo}.csv`, [
                { Date: '2026-10-17', Status: 'Present', Remarks: 'On Time' },
                { Date: '2026-10-16', Status: 'Present', Remarks: 'On Time' },
                { Date: '2026-10-15', Status: 'Absent', Remarks: 'Medical leave' },
                { Date: '2026-10-14', Status: 'Present', Remarks: 'On Time' },
                { Date: '2026-10-13', Status: 'Present', Remarks: 'On Time' },
              ])}
            >
              <Download size={14} />
              <span>Export Attendance Log (CSV)</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>17 Oct 2026</td>
                  <td>Friday</td>
                  <td>Morning Batch</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td style={{ color: '#64748B' }}>On Time</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>16 Oct 2026</td>
                  <td>Thursday</td>
                  <td>Morning Batch</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td style={{ color: '#64748B' }}>On Time</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>15 Oct 2026</td>
                  <td>Wednesday</td>
                  <td>Morning Batch</td>
                  <td><span className="badge badge-danger">Absent</span></td>
                  <td style={{ color: '#64748B' }}>Sick Leave notified by parent</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>14 Oct 2026</td>
                  <td>Tuesday</td>
                  <td>Morning Batch</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td style={{ color: '#64748B' }}>On Time</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>13 Oct 2026</td>
                  <td>Monday</td>
                  <td>Morning Batch</td>
                  <td><span className="badge badge-success">Present</span></td>
                  <td style={{ color: '#64748B' }}>On Time</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 4. Examinations */}
      {activeTab === 'Examinations' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>School Examination Results</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Official school examination records and term report cards.</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => downloadSampleDocument(`Report_Card_${student.admissionNo}.pdf`, `SCHOOL EXAM REPORT CARD\nStudent: ${student.name} (${student.admissionNo})\nClass: ${student.class}\nExam: Half Yearly Examination 2026\nMaths: 85/100\nScience: 78/100\nEnglish: 72/100\nTotal: 235/300 (78.3%)\nGrade: A`)}
            >
              <Download size={14} />
              <span>Download Term Report Card</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Academic Term</th>
                  <th>Date Conducted</th>
                  <th>Total Marks</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Half Yearly Examination</td>
                  <td>Term 1 (2026-27)</td>
                  <td>10 Oct 2026</td>
                  <td>468 / 600</td>
                  <td><span className="badge badge-success">78.0%</span></td>
                  <td><strong>A</strong></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Unit Test 2</td>
                  <td>Term 1 (2026-27)</td>
                  <td>25 Aug 2026</td>
                  <td>205 / 250</td>
                  <td><span className="badge badge-success">82.0%</span></td>
                  <td><strong>A+</strong></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Periodic Test 1</td>
                  <td>Term 1 (2026-27)</td>
                  <td>15 Jul 2026</td>
                  <td>185 / 250</td>
                  <td><span className="badge badge-success">74.0%</span></td>
                  <td><strong>B+</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 5. Tuition Tests */}
      {activeTab === 'Tuition Tests' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Tuition Internal Tests</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Weekly and monthly evaluations conducted inside Tutorly.</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCSV(`Tuition_Tests_${student.admissionNo}.csv`, [
                { Test: 'Monthly Test (Oct)', Subject: 'Mathematics', Scored: 44, Max: 50, Percentage: '88%' },
                { Test: 'Weekly Quiz 4', Subject: 'Science', Scored: 22, Max: 25, Percentage: '88%' },
                { Test: 'Chapter Test 3', Subject: 'Physics', Scored: 38, Max: 50, Percentage: '76%' },
              ])}
            >
              <Download size={14} />
              <span>Export Test History (CSV)</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test Title</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Marks Scored</th>
                  <th>Rank in Batch</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Monthly Test (October)</td>
                  <td>Mathematics</td>
                  <td>05 Aug 2026</td>
                  <td>44 / 50</td>
                  <td>3rd of 36</td>
                  <td><span className="badge badge-success">88%</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Weekly Quiz 4</td>
                  <td>Science</td>
                  <td>22 Jul 2026</td>
                  <td>22 / 25</td>
                  <td>5th of 36</td>
                  <td><span className="badge badge-success">88%</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Chapter Test 1</td>
                  <td>Physics</td>
                  <td>12 Jul 2026</td>
                  <td>38 / 50</td>
                  <td>9th of 36</td>
                  <td><span className="badge badge-success">76%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Tab: 7. Fees & Payments */}
      {activeTab === 'Fees & Payments' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Fee Ledger & Payment Receipts</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Complete record of billed installments, received payments, and receipts.</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadCSV(`Fee_Ledger_${student.admissionNo}.csv`, [
                { Month: 'October 2026', Head: 'Tuition Fee', Amount: '3000', Status: 'Paid', Receipt: 'REC-2026-089' },
                { Month: 'September 2026', Head: 'Tuition Fee', Amount: '3000', Status: 'Paid', Receipt: 'REC-2026-042' },
                { Month: 'November 2026', Head: 'Tuition Fee', Amount: '3000', Status: 'Pending', Receipt: '-' },
              ])}
            >
              <Download size={14} />
              <span>Export Ledger (CSV)</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period / Fee Head</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Receipt No</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>October 2026 Tuition Fee</td>
                  <td>₹3,000</td>
                  <td>05 Oct 2026</td>
                  <td><span className="badge badge-success">Paid (UPI)</span></td>
                  <td><code>REC-2026-089</code></td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => downloadSampleDocument(`Receipt_REC-2026-089.pdf`, `TUTORLY TUITION RECEIPT\nReceipt: REC-2026-089\nStudent: ${student.name}\nAmount: INR 3,000\nPayment Mode: UPI\nDate: 04 Oct 2026\nStatus: Fully Paid`)}
                    >
                      <Download size={12} />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>September 2026 Tuition Fee</td>
                  <td>₹3,000</td>
                  <td>05 Sep 2026</td>
                  <td><span className="badge badge-success">Paid (Cash)</span></td>
                  <td><code>REC-2026-042</code></td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => downloadSampleDocument(`Receipt_REC-2026-042.pdf`, `TUTORLY TUITION RECEIPT\nReceipt: REC-2026-042\nStudent: ${student.name}\nAmount: INR 3,000\nPayment Mode: Cash\nDate: 02 Sep 2026\nStatus: Fully Paid`)}
                    >
                      <Download size={12} />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>November 2026 Tuition Fee</td>
                  <td>₹3,000</td>
                  <td>05 Nov 2026</td>
                  <td><span className="badge badge-warning">Pending</span></td>
                  <td>-</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={() => navigateTo('fee-collection')}
                    >
                      Collect Now
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Tab: 9. History */}
      {activeTab === 'History' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Student Lifecycle & Audit Trail</h2>
            <p style={{ fontSize: '13px', color: '#64748B' }}>Immutable log of enrollment, batch transfers, and academic milestones.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid #E2E8F0', paddingLeft: '20px', marginLeft: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366F1' }}>25 OCT 2026 • 11:30 AM</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Academic Audit & Profile Verified</div>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>Profile details and attendance logs verified by Admin.</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>10 OCT 2026 • 04:15 PM</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Half Yearly Exam Marks Recorded</div>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>Marks entry finalized with 78% average score.</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#F59E0B' }}>01 JUN 2026 • 09:00 AM</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Enrolled into Class 10 (Batch A)</div>
              <div style={{ fontSize: '12.5px', color: '#64748B' }}>Admission No {student.admissionNo} issued. Parent Ramesh Reddy registered as primary contact.</div>
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
                    <select
                      value={editFormData.class}
                      onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Class 10</option>
                      <option>Class 9</option>
                      <option>Class 8</option>
                      <option>Class 7</option>
                      <option>Class 6</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <select
                      value={editFormData.batch}
                      onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Batch A</option>
                      <option>Batch B</option>
                      <option>Batch C</option>
                    </select>
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
                  <strong>Academic Continuity Notice:</strong> Promoting {student.name} will maintain their complete test scores, report cards, and fee receipts permanently in their academic history.
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
                      <option>Class 11</option>
                      <option>Class 10</option>
                      <option>Class 9</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assign Batch</label>
                    <select className="select-field" style={{ width: '100%' }}>
                      <option>Batch A (Morning)</option>
                      <option>Batch B (Evening)</option>
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

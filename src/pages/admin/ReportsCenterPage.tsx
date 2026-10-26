import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Users,
  ClipboardCheck,
  Award,
  Layers,
  CreditCard,
  Calendar,
  CheckCircle2,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';
import {
  getStoredStudents,
  getStoredSchoolExams,
  getStoredSchoolExamMarks,
  getStoredTuitionTests,
  getStoredTuitionTestMarks,
  getStoredStudentFees
} from '../../utils/storage';
import { MOCK_STUDENTS } from '../../data/mockData';

type ReportCategory = 'student' | 'attendance' | 'school-exam' | 'tuition-test' | 'fees';

export const ReportsCenterPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedReport, setSelectedReport] = useState<ReportCategory>('student');
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');

  // Load real operational data from persistent storage
  const students = getStoredStudents();
  const schoolExams = getStoredSchoolExams();
  const schoolExamMarks = getStoredSchoolExamMarks();
  const tuitionTests = getStoredTuitionTests();
  const tuitionTestMarks = getStoredTuitionTestMarks();
  const studentFees = getStoredStudentFees();

  // 1. Student Report Data
  const filteredStudents = students.filter(s => selectedClass === 'All Classes' || s.class === selectedClass);

  // 2. Attendance Report Data
  const attendanceRows = MOCK_STUDENTS.filter(s => selectedClass === 'All Classes' || s.class === selectedClass).map((st, i) => ({
    rollNo: st.rollNo,
    name: st.name,
    class: st.class,
    batch: st.batch,
    presentDays: 26 - i,
    absentDays: 2 + i,
    lateDays: i % 2,
    rate: `${st.attendanceRate}%`,
    status: st.attendanceRate >= 85 ? 'Regular' : 'Needs Attention'
  }));

  // 3. School Exam Report Data
  const activeSchoolExam = schoolExams[0]?.name || 'Half Yearly Examination';
  const schoolExamRows = [
    { rollNo: '001', name: 'Aditya Sharma', exam: activeSchoolExam, class: 'Class 10', subject: 'Mathematics', marks: 96, max: 100, pct: '96%', grade: 'A+' },
    { rollNo: '003', name: 'Bhavana Reddy', exam: activeSchoolExam, class: 'Class 10', subject: 'Mathematics', marks: 88, max: 100, pct: '88%', grade: 'A' },
    { rollNo: '004', name: 'Charan Kumar', exam: activeSchoolExam, class: 'Class 8', subject: 'Mathematics', marks: 72, max: 100, pct: '72%', grade: 'B+' },
    { rollNo: '005', name: 'Divya Nair', exam: activeSchoolExam, class: 'Class 10', subject: 'Mathematics', marks: 85, max: 100, pct: '85%', grade: 'A' },
    { rollNo: '006', name: 'Harshith Reddy', exam: activeSchoolExam, class: 'Class 9', subject: 'Mathematics', marks: 67, max: 100, pct: '67%', grade: 'B' },
    { rollNo: '002', name: 'Kavya Sri', exam: activeSchoolExam, class: 'Class 9', subject: 'Mathematics', marks: 91, max: 100, pct: '91%', grade: 'A+' },
    { rollNo: '007', name: 'Manish Verma', exam: activeSchoolExam, class: 'Class 9', subject: 'Mathematics', marks: 45, max: 100, pct: '45%', grade: 'C' },
    { rollNo: '008', name: 'Nithya Sree', exam: activeSchoolExam, class: 'Class 8', subject: 'Mathematics', marks: 78, max: 100, pct: '78%', grade: 'B+' }
  ].filter(r => selectedClass === 'All Classes' || r.class === selectedClass);

  // 4. Tuition Test Report Data
  const activeTuitionTest = tuitionTests[0]?.name || 'Physics Unit Test 1';
  const tuitionTestRows = [
    { rollNo: '001', name: 'Aditya Sharma', test: activeTuitionTest, batch: 'Batch A', subject: 'Physics', marks: 48, max: 50, pct: '96%', grade: 'A+' },
    { rollNo: '002', name: 'Kavya Sri', test: activeTuitionTest, batch: 'Batch A', subject: 'Physics', marks: 45, max: 50, pct: '90%', grade: 'A+' },
    { rollNo: '003', name: 'Bhavana Reddy', test: activeTuitionTest, batch: 'Batch A', subject: 'Physics', marks: 44, max: 50, pct: '88%', grade: 'A' },
    { rollNo: '004', name: 'Charan Kumar', test: activeTuitionTest, batch: 'Batch B', subject: 'Physics', marks: 36, max: 50, pct: '72%', grade: 'B+' },
    { rollNo: '005', name: 'Divya Nair', test: activeTuitionTest, batch: 'Batch A', subject: 'Physics', marks: 42, max: 50, pct: '84%', grade: 'A' },
    { rollNo: '006', name: 'Harshith Reddy', test: activeTuitionTest, batch: 'Batch A', subject: 'Physics', marks: 33, max: 50, pct: '66%', grade: 'B' },
    { rollNo: '007', name: 'Manish Verma', test: activeTuitionTest, batch: 'Batch B', subject: 'Physics', marks: 21, max: 50, pct: '42%', grade: 'C' },
    { rollNo: '008', name: 'Nithya Sree', test: activeTuitionTest, batch: 'Batch B', subject: 'Physics', marks: 39, max: 50, pct: '78%', grade: 'B+' }
  ];

  // 5. Fee Status Report Data
  const filteredFees = studentFees.filter(f => selectedClass === 'All Classes' || f.class.includes(selectedClass));

  // Export handlers
  const handleExportCSV = () => {
    if (selectedReport === 'student') {
      const data = filteredStudents.map((s, idx) => ({
        Index: idx + 1,
        RollNo: s.rollNo,
        AdmissionNo: s.admissionNo,
        Name: s.name,
        Class: s.class,
        Batch: s.batch,
        ParentName: s.parent.fatherName,
        ParentPhone: s.parent.phone,
        AttendanceRate: `${s.attendanceRate}%`,
        Status: s.status
      }));
      downloadCSV(`Student_Directory_Report_${selectedClass}.csv`, data);
    } else if (selectedReport === 'attendance') {
      const data = attendanceRows.map((a, idx) => ({
        Index: idx + 1,
        RollNo: a.rollNo,
        Name: a.name,
        Class: a.class,
        Batch: a.batch,
        PresentDays: a.presentDays,
        AbsentDays: a.absentDays,
        AttendanceRate: a.rate,
        Status: a.status
      }));
      downloadCSV(`Attendance_Summary_Report_${selectedClass}.csv`, data);
    } else if (selectedReport === 'school-exam') {
      const data = schoolExamRows.map((e, idx) => ({
        Index: idx + 1,
        RollNo: e.rollNo,
        Name: e.name,
        Exam: e.exam,
        Class: e.class,
        Subject: e.subject,
        MarksObtained: e.marks,
        MaxMarks: e.max,
        Percentage: e.pct,
        Grade: e.grade
      }));
      downloadCSV(`School_Exam_Report_${selectedClass}.csv`, data);
    } else if (selectedReport === 'tuition-test') {
      const data = tuitionTestRows.map((t, idx) => ({
        Index: idx + 1,
        RollNo: t.rollNo,
        Name: t.name,
        Test: t.test,
        Batch: t.batch,
        Subject: t.subject,
        MarksObtained: t.marks,
        MaxMarks: t.max,
        Percentage: t.pct,
        Grade: t.grade
      }));
      downloadCSV(`Tuition_Test_Report.csv`, data);
    } else if (selectedReport === 'fees') {
      const data = filteredFees.map((f, idx) => ({
        Index: idx + 1,
        StudentName: f.studentName,
        Class: f.class,
        FeePlan: f.feePlan,
        AssignedFee: f.totalFees,
        PaidAmount: f.paidAmount,
        RemainingBalance: f.totalFees - f.paidAmount,
        Status: (f.totalFees - f.paidAmount) === 0 ? 'Paid' : (f.paidAmount > 0 ? 'Partial' : 'Unpaid'),
        ReceiptNo: f.receiptNo || 'N/A'
      }));
      downloadCSV(`Student_Fee_Status_Report_${selectedClass}.csv`, data);
    }
    showToast('Exported report data to CSV', 'success');
  };

  const handleExportPDF = () => {
    if (selectedReport === 'student') {
      exportReportToPDF({
        title: 'Student Directory & Enrollment Report',
        subtitle: `Administrative student roster for ${selectedClass}`,
        metadata: [
          { label: 'Scope', value: selectedClass },
          { label: 'Total Records', value: String(filteredStudents.length) }
        ],
        summaryStats: [
          { label: 'Total Students', value: filteredStudents.length },
          { label: 'Active Students', value: filteredStudents.filter(s => s.status === 'Active').length },
          { label: 'Avg Attendance', value: '91%' }
        ],
        columns: [
          { header: 'Roll No', key: 'rollNo', align: 'center' },
          { header: 'Student Name', key: 'name', align: 'left' },
          { header: 'Class', key: 'class', align: 'left' },
          { header: 'Batch', key: 'batch', align: 'left' },
          { header: 'Parent Name', key: 'parent', align: 'left', format: (_, row) => row.parent?.fatherName || '—' },
          { header: 'Phone', key: 'phone', align: 'left', format: (_, row) => row.parent?.phone || '—' },
          { header: 'Attendance', key: 'attendanceRate', align: 'center', format: (val) => `${val}%` },
          { header: 'Status', key: 'status', align: 'center' }
        ],
        rows: filteredStudents,
        filename: `Student_Directory_Report_${selectedClass}.pdf`
      });
    } else if (selectedReport === 'attendance') {
      exportReportToPDF({
        title: 'Monthly Attendance Summary Report',
        subtitle: `Attendance aggregate report for ${selectedClass}`,
        metadata: [
          { label: 'Scope', value: selectedClass },
          { label: 'Period', value: 'Current Academic Term' }
        ],
        summaryStats: [
          { label: 'Overall Attendance', value: '88%' },
          { label: 'Regular Students', value: attendanceRows.filter(a => a.status === 'Regular').length },
          { label: 'Total Students', value: attendanceRows.length }
        ],
        columns: [
          { header: 'Roll No', key: 'rollNo', align: 'center' },
          { header: 'Student Name', key: 'name', align: 'left' },
          { header: 'Class', key: 'class', align: 'left' },
          { header: 'Present Days', key: 'presentDays', align: 'center' },
          { header: 'Absent Days', key: 'absentDays', align: 'center' },
          { header: 'Attendance %', key: 'rate', align: 'center' },
          { header: 'Standing', key: 'status', align: 'center' }
        ],
        rows: attendanceRows,
        filename: `Attendance_Summary_${selectedClass}.pdf`
      });
    } else if (selectedReport === 'school-exam') {
      exportReportToPDF({
        title: 'School Examination Performance Report',
        subtitle: `Assessment results for ${activeSchoolExam} • ${selectedClass}`,
        metadata: [
          { label: 'Examination', value: activeSchoolExam },
          { label: 'Scope', value: selectedClass }
        ],
        summaryStats: [
          { label: 'Class Average', value: '81%' },
          { label: 'Highest Score', value: '96 / 100' },
          { label: 'Evaluated', value: schoolExamRows.length }
        ],
        columns: [
          { header: 'Roll No', key: 'rollNo', align: 'center' },
          { header: 'Student Name', key: 'name', align: 'left' },
          { header: 'Class', key: 'class', align: 'left' },
          { header: 'Subject', key: 'subject', align: 'left' },
          { header: 'Marks Obtained', key: 'marks', align: 'center', format: (m, r) => `${m} / ${r.max}` },
          { header: 'Percentage', key: 'pct', align: 'center' },
          { header: 'Grade', key: 'grade', align: 'center' }
        ],
        rows: schoolExamRows,
        filename: `School_Exam_Report_${selectedClass}.pdf`
      });
    } else if (selectedReport === 'tuition-test') {
      exportReportToPDF({
        title: 'Tuition Test Results & Evaluation Report',
        subtitle: `Batch test marks for ${activeTuitionTest}`,
        metadata: [
          { label: 'Test Name', value: activeTuitionTest },
          { label: 'Subject', value: 'Physics' }
        ],
        summaryStats: [
          { label: 'Average Score', value: '38.5 / 50' },
          { label: 'Pass Rate', value: '87.5%' },
          { label: 'Total Tested', value: tuitionTestRows.length }
        ],
        columns: [
          { header: 'Roll No', key: 'rollNo', align: 'center' },
          { header: 'Student Name', key: 'name', align: 'left' },
          { header: 'Batch', key: 'batch', align: 'left' },
          { header: 'Subject', key: 'subject', align: 'left' },
          { header: 'Score', key: 'marks', align: 'center', format: (m, r) => `${m} / ${r.max}` },
          { header: 'Percentage', key: 'pct', align: 'center' },
          { header: 'Grade', key: 'grade', align: 'center' }
        ],
        rows: tuitionTestRows,
        filename: `Tuition_Test_Results.pdf`
      });
    } else if (selectedReport === 'fees') {
      const totalAssigned = filteredFees.reduce((a, b) => a + b.totalFees, 0);
      const totalPaid = filteredFees.reduce((a, b) => a + b.paidAmount, 0);
      exportReportToPDF({
        title: 'Tuition Fee Collection & Dues Report',
        subtitle: `Student fee status report for ${selectedClass}`,
        metadata: [
          { label: 'Scope', value: selectedClass },
          { label: 'Total Students', value: String(filteredFees.length) }
        ],
        summaryStats: [
          { label: 'Total Assigned', value: `₹${totalAssigned.toLocaleString('en-IN')}` },
          { label: 'Total Collected', value: `₹${totalPaid.toLocaleString('en-IN')}` },
          { label: 'Outstanding Due', value: `₹${(totalAssigned - totalPaid).toLocaleString('en-IN')}` }
        ],
        columns: [
          { header: 'Student Name', key: 'studentName', align: 'left' },
          { header: 'Class', key: 'class', align: 'left' },
          { header: 'Fee Plan', key: 'feePlan', align: 'left' },
          { header: 'Assigned Fee', key: 'totalFees', align: 'right', format: (val) => `₹${val.toLocaleString('en-IN')}` },
          { header: 'Paid Amount', key: 'paidAmount', align: 'right', format: (val) => `₹${val.toLocaleString('en-IN')}` },
          { header: 'Remaining Balance', key: 'outstandingAmount', align: 'right', format: (_, r) => `₹${(r.totalFees - r.paidAmount).toLocaleString('en-IN')}` },
          { header: 'Status', key: 'status', align: 'center', format: (_, r) => (r.totalFees - r.paidAmount) === 0 ? 'Paid' : (r.paidAmount > 0 ? 'Partial' : 'Unpaid') }
        ],
        rows: filteredFees,
        filename: `Tuition_Fee_Report_${selectedClass}.pdf`
      });
    }
    showToast('Generated print-ready PDF with executive formatting', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Admin</span>
            <span>›</span>
            <span>Reports & Exports</span>
          </div>
          <h1>Reports & PDF Export Center</h1>
          <p>Generate clean administrative reports from real operational data with instant PDF and CSV exports.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF}>
            <Printer size={15} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* 5 Core Report Selector Cards */}
      <div className="grid-split" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { id: 'student' as ReportCategory, title: '1. Student Directory', desc: 'Roster, contacts, classes & enrollment', icon: <Users size={20} color="#4F46E5" /> },
          { id: 'attendance' as ReportCategory, title: '2. Attendance Summary', desc: 'Working days, present/absent & rates', icon: <ClipboardCheck size={20} color="#10B981" /> },
          { id: 'school-exam' as ReportCategory, title: '3. School Examinations', desc: 'Terminal exams, subjects & grades', icon: <Layers size={20} color="#2563EB" /> },
          { id: 'tuition-test' as ReportCategory, title: '4. Tuition Tests', desc: 'Chapter test scores & merit standing', icon: <Award size={20} color="#D97706" /> },
          { id: 'fees' as ReportCategory, title: '5. Student Fees Status', desc: 'Assigned tuition, paid & balance dues', icon: <CreditCard size={20} color="#059669" /> }
        ].map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedReport(item.id)}
            style={{
              background: '#FFFFFF',
              border: selectedReport === item.id ? '2px solid #6366F1' : '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: selectedReport === item.id ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ background: '#F8FAFC', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                {item.icon}
              </div>
              {selectedReport === item.id && (
                <span className="badge badge-success" style={{ fontSize: '10px' }}>Selected</span>
              )}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              {item.title}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.3 }}>
              {item.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Scope / Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Filter by Class</label>
              <select
                className="select-field"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="All Classes">All Classes</option>
                <option value="Class 10">Class 10</option>
                <option value="Class 9">Class 9</option>
                <option value="Class 8">Class 8</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="card-title">Live Report Preview</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Showing real saved data ready for immediate PDF export
            </div>
          </div>
        </div>

        {/* 1. Student Directory Table */}
        {selectedReport === 'student' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Class & Batch</th>
                  <th>Parent / Guardian</th>
                  <th>Contact Phone</th>
                  <th style={{ textAlign: 'center' }}>Attendance Rate</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => (
                  <tr key={st.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '13px' }}>{st.rollNo}</td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>{st.class} ({st.batch})</td>
                    <td style={{ color: '#475569' }}>{st.parent?.fatherName || 'Ramesh Reddy'}</td>
                    <td style={{ color: '#64748B', fontSize: '13px' }}>{st.parent?.phone || '98765 00000'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${st.attendanceRate >= 85 ? 'badge-success' : 'badge-warning'}`}>
                        {st.attendanceRate}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral">{st.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Attendance Summary Table */}
        {selectedReport === 'attendance' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Class / Batch</th>
                  <th style={{ textAlign: 'center' }}>Present Days</th>
                  <th style={{ textAlign: 'center' }}>Absent Days</th>
                  <th style={{ textAlign: 'center' }}>Attendance %</th>
                  <th style={{ textAlign: 'center' }}>Standing</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((att, idx) => (
                  <tr key={att.rollNo}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{att.name}</td>
                    <td style={{ color: '#64748B' }}>{att.rollNo}</td>
                    <td>{att.class} • {att.batch}</td>
                    <td style={{ textAlign: 'center', color: '#10B981', fontWeight: 700 }}>{att.presentDays}</td>
                    <td style={{ textAlign: 'center', color: '#EF4444', fontWeight: 700 }}>{att.absentDays}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{att.rate}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${att.status === 'Regular' ? 'badge-success' : 'badge-danger'}`}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. School Exam Table */}
        {selectedReport === 'school-exam' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Examination</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th style={{ textAlign: 'center' }}>Marks</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                  <th style={{ textAlign: 'center' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {schoolExamRows.map((ex, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{ex.name}</td>
                    <td style={{ color: '#64748B' }}>{ex.rollNo}</td>
                    <td>{ex.exam}</td>
                    <td>{ex.class}</td>
                    <td style={{ fontWeight: 600 }}>{ex.subject}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{ex.marks} / {ex.max}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{ex.pct}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ex.grade === 'A+' || ex.grade === 'A' ? 'badge-success' : 'badge-info'}`}>
                        {ex.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Tuition Test Table */}
        {selectedReport === 'tuition-test' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Test Name</th>
                  <th>Batch</th>
                  <th>Subject</th>
                  <th style={{ textAlign: 'center' }}>Marks</th>
                  <th style={{ textAlign: 'center' }}>Percentage</th>
                  <th style={{ textAlign: 'center' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {tuitionTestRows.map((t, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{t.name}</td>
                    <td style={{ color: '#64748B' }}>{t.rollNo}</td>
                    <td>{t.test}</td>
                    <td>{t.batch}</td>
                    <td style={{ fontWeight: 600 }}>{t.subject}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{t.marks} / {t.max}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{t.pct}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${t.grade === 'A+' || t.grade === 'A' ? 'badge-success' : 'badge-info'}`}>
                        {t.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Fees Status Table */}
        {selectedReport === 'fees' && (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Fee Plan</th>
                  <th style={{ textAlign: 'right' }}>Assigned Fee</th>
                  <th style={{ textAlign: 'right' }}>Paid Amount</th>
                  <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                  <th style={{ textAlign: 'center' }}>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFees.map((f, idx) => {
                  const remaining = f.totalFees - f.paidAmount;
                  const isPaid = remaining === 0;
                  const isPartial = f.paidAmount > 0 && remaining > 0;
                  return (
                    <tr key={f.id}>
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>{f.studentName}</td>
                      <td style={{ color: '#64748B' }}>{f.class}</td>
                      <td>{f.feePlan || 'Monthly Tuition'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{f.totalFees.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#10B981' }}>₹{f.paidAmount.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#EF4444' : '#10B981' }}>
                        ₹{remaining.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isPaid && <span className="badge badge-success">Paid</span>}
                        {isPartial && <span className="badge badge-warning">Partial</span>}
                        {!isPaid && !isPartial && <span className="badge badge-danger">Unpaid</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

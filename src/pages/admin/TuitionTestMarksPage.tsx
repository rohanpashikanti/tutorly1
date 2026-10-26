import React, { useState } from 'react';
import {
  Award,
  Save,
  Upload,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Edit2,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart, BarChart } from '../../components/charts/Charts';
import { MOCK_STUDENTS } from '../../data/mockData';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

interface StudentRow {
  id: string;
  name: string;
  rollNo: string;
  avatar: string;
  marks: number;
  pct: number;
  grade: string;
  remarks: string;
  status: string;
}

export const TuitionTestMarksPage: React.FC = () => {
  const { showToast, navigateTo } = useApp();
  const [selectedTest, setSelectedTest] = useState('Physics Unit Test 1');
  const [selectedClass, setSelectedClass] = useState('Class 10 - A');
  const [selectedSubject, setSelectedSubject] = useState('Physics');

  const [studentRows, setStudentRows] = useState<StudentRow[]>([
    { id: '1', name: 'Aditya Sharma', rollNo: '001', avatar: MOCK_STUDENTS[0].avatar, marks: 96, pct: 96, grade: 'A+', remarks: 'Excellent', status: 'Entered' },
    { id: '2', name: 'Bhavana Reddy', rollNo: '002', avatar: MOCK_STUDENTS[2].avatar, marks: 88, pct: 88, grade: 'A', remarks: 'Very Good', status: 'Entered' },
    { id: '3', name: 'Charan Kumar', rollNo: '003', avatar: MOCK_STUDENTS[3].avatar, marks: 72, pct: 72, grade: 'B+', remarks: 'Good', status: 'Entered' },
    { id: '4', name: 'Divya Nair', rollNo: '004', avatar: MOCK_STUDENTS[4].avatar, marks: 85, pct: 85, grade: 'A', remarks: 'Very Good', status: 'Entered' },
    { id: '5', name: 'Harshith Reddy', rollNo: '005', avatar: MOCK_STUDENTS[5].avatar, marks: 67, pct: 67, grade: 'B', remarks: 'Can improve', status: 'Entered' },
    { id: '6', name: 'Kavya Sri', rollNo: '006', avatar: MOCK_STUDENTS[1].avatar, marks: 91, pct: 91, grade: 'A+', remarks: 'Excellent', status: 'Entered' },
    { id: '7', name: 'Manish Verma', rollNo: '007', avatar: MOCK_STUDENTS[6].avatar, marks: 42, pct: 42, grade: 'C', remarks: 'Needs improvement', status: 'Entered' },
    { id: '8', name: 'Nithya Sree', rollNo: '008', avatar: MOCK_STUDENTS[7].avatar, marks: 78, pct: 78, grade: 'B+', remarks: 'Good', status: 'Entered' },
  ]);

  const handleExportCSV = () => {
    const data = studentRows.map((s) => ({
      RollNo: s.rollNo,
      Name: s.name,
      Test: selectedTest,
      Class: selectedClass,
      Subject: selectedSubject,
      MarksObtained: s.marks,
      Percentage: `${s.pct}%`,
      Grade: s.grade,
      Remarks: s.remarks,
      Status: s.status,
    }));
    downloadCSV(`Tuition_Test_Marks_${selectedTest.replace(/\s+/g, '_')}.csv`, data);
    showToast(`Exported ${studentRows.length} marks entries to CSV`, 'success');
  };

  const handleDownloadTemplate = () => {
    const template = 'RollNo,Name,Test,Marks(100)\n001,Aditya Sharma,Physics Unit Test 1,96\n002,Bhavana Reddy,Physics Unit Test 1,88\n003,Charan Kumar,Physics Unit Test 1,72';
    downloadSampleDocument('Tuition_Test_Marks_Template.csv', template, 'text/csv');
    showToast('Downloaded sample Excel/CSV test marks template', 'success');
  };

  const handleMarkChange = (id: string, val: string) => {
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    setStudentRows((prev) =>
      prev.map((s) => (s.id === id ? { ...s, marks: num, pct: num } : s))
    );
  };

  const handleSave = () => {
    showToast(`Tuition test marks saved for ${selectedTest}!`, 'success');
  };

  const gradeDist = [
    { label: 'A+', value: 8, color: '#A7F3D0' },
    { label: 'A', value: 7, color: '#BFDBFE' },
    { label: 'B+', value: 6, color: '#FDE68A' },
    { label: 'B', value: 4, color: '#FDBA74' },
    { label: 'C', value: 2, color: '#FCA5A5' },
    { label: 'D', value: 1, color: '#F87171' },
  ];

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Tuition Tests</span>
            <span>›</span>
            <span>Test Marks Entry</span>
          </div>
          <h1>Tuition Test Marks Entry</h1>
          <p>Enter, edit and manage student marks for tuition tests with class-wise and subject-wise views.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigateTo('tuition-test-results')}>
            View Published Results
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={15} />
            <span>Save Marks</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="filter-bar">
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Select Test</label>
            <select className="select-field" value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}>
              <option>Physics Unit Test 1</option>
              <option>Maths Weekly Test</option>
              <option>Chemistry Chapter 2</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Class</label>
            <select className="select-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option>Class 10 - A</option>
              <option>Class 10 - B</option>
              <option>Class 9 - A</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Subject</label>
            <select className="select-field" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option>Physics</option>
              <option>Mathematics</option>
              <option>Chemistry</option>
            </select>
          </div>
        </div>

        <button className="btn btn-sm btn-secondary" onClick={handleDownloadTemplate} title="Download Excel template for offline entry">
          <Download size={14} />
          <span>Excel Template</span>
        </button>
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple"><Users size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">28</div>
            <div className="stat-footer"><span className="stat-subtext">Class 10 - A</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Marks Entered</div>
            <div className="stat-value">28</div>
            <div className="stat-footer"><span className="stat-badge-change positive">100% completed</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Pending</div>
            <div className="stat-value">0</div>
            <div className="stat-footer"><span className="stat-subtext">All entered</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Class Average</div>
            <div className="stat-value">78.6%</div>
            <div className="stat-footer"><span className="stat-badge-change positive">↑ +5%</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink"><Award size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Highest Score</div>
            <div className="stat-value">96 / 100</div>
            <div className="stat-footer"><span className="stat-subtext">Aditya Sharma</span></div>
          </div>
        </div>
      </div>

      {/* Grid: Table + Right Test Information & Stats */}
      <div className="grid-split">
        
        {/* Marks Table Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Student Marks Entry (28)</div>
            <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" /></th>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No.</th>
                  <th style={{ width: '120px' }}>Marks (100)</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((st, idx) => (
                  <tr key={st.id}>
                    <td><input type="checkbox" /></td>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>{st.rollNo}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={st.marks}
                        onChange={(e) => handleMarkChange(st.id, e.target.value)}
                        style={{
                          width: '74px',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontWeight: 700,
                          textAlign: 'center',
                          color: '#0F172A',
                        }}
                      />
                    </td>
                    <td><span className="badge badge-purple">{st.grade}</span></td>
                    <td style={{ color: '#64748B', fontSize: '12px' }}>{st.remarks}</td>
                    <td><span className="badge badge-success">Entered</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Info Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card">
            <div className="card-header">
              <div className="card-title">Test Information</div>
              <button style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600 }}>Edit</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Test Name</span>
                <strong>{selectedTest}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Type</span>
                <span className="badge badge-info">Unit Test</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Class</span>
                <strong>{selectedClass}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Max Marks</span>
                <strong>100</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: '#64748B' }}>Duration</span>
                <strong>60 minutes</strong>
              </div>
            </div>
          </div>

          {/* Marks Statistics Donut */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Marks Statistics</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <DonutChart value={78.6} size={110} label="78.6%" sublabel="Class Avg" color="#6366F1" />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Students Passed</span><strong style={{ color: '#10B981' }}>26 (93%)</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Students Failed</span><strong style={{ color: '#EF4444' }}>2 (7%)</strong></div>
              </div>
            </div>
          </div>

          {/* Grade Distribution Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">Grade Distribution</div></div>
            <div className="card-body"><BarChart data={gradeDist} height={120} valueFormatter={(v) => `${v}`} /></div>
          </div>

        </div>

      </div>
    </div>
  );
};

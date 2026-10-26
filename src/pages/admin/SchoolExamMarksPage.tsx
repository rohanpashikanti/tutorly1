import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Save,
  CheckCircle2,
  TrendingUp,
  Award,
  Users,
  BookOpen,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart, BarChart } from '../../components/charts/Charts';
import { getStoredStudents } from '../../utils/storage';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

interface StudentMarkRow {
  id: string;
  name: string;
  rollNo: string;
  avatar: string;
  marks: number;
  maxMarks: number;
  grade: string;
  percentage: number;
  remarks: string;
}

export const SchoolExamMarksPage: React.FC = () => {
  const { showToast, navigateTo } = useApp();
  const [selectedExam, setSelectedExam] = useState('Half Yearly Examination');
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [selectedSection, setSelectedSection] = useState('A');
  const [activeSubject, setActiveSubject] = useState('Mathematics');

  const [marksData, setMarksData] = useState<StudentMarkRow[]>(() => {
    return getStoredStudents().map((s) => ({
      id: s.id,
      name: s.name,
      rollNo: s.rollNo,
      avatar: s.avatar,
      marks: 0,
      maxMarks: 100,
      grade: '—',
      percentage: 0,
      remarks: '',
    }));
  });

  const handleExportCSV = () => {
    const data = marksData.map((r) => ({
      RollNo: r.rollNo,
      Name: r.name,
      Subject: activeSubject,
      Marks: r.marks,
      MaxMarks: r.maxMarks,
      Grade: r.grade,
      Percentage: `${r.percentage}%`,
      Remarks: r.remarks,
      Examination: selectedExam,
      Class: `${selectedClass} - ${selectedSection}`,
    }));
    downloadCSV(`School_Exam_Marks_${activeSubject}_${selectedClass.replace(/\s+/g, '_')}.csv`, data);
    showToast(`Exported ${marksData.length} student marks for ${activeSubject}`, 'success');
  };

  const handleDownloadTemplate = () => {
    const template = 'RollNo,Name,Subject,Marks\n001,Aditya Sharma,Mathematics,95\n002,Bhavana Reddy,Mathematics,88\n003,Charan Kumar,Mathematics,72';
    downloadSampleDocument('School_Exam_Marks_Template.csv', template, 'text/csv');
    showToast('Downloaded sample Excel/CSV marks template', 'success');
  };

  const calculateGrade = (m: number, max: number) => {
    const pct = (m / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
  };

  const handleMarksChange = (id: string, val: string) => {
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    setMarksData((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const grade = calculateGrade(num, row.maxMarks);
          return {
            ...row,
            marks: num,
            percentage: num,
            grade,
          };
        }
        return row;
      })
    );
  };

  const handleSaveMarks = () => {
    showToast(`Saved marks for ${activeSubject} (${selectedExam})!`, 'success');
  };

  const gradeDistribution = [
    { label: 'A+', value: 8, color: '#A7F3D0' },
    { label: 'A', value: 9, color: '#BFDBFE' },
    { label: 'B+', value: 7, color: '#FDE68A' },
    { label: 'B', value: 5, color: '#FDBA74' },
    { label: 'C', value: 2, color: '#FCA5A5' },
    { label: 'D', value: 1, color: '#F87171' },
  ];

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Examinations</span>
            <span>›</span>
            <span>School Examinations</span>
            <span>›</span>
            <span>Marks</span>
          </div>
          <h1>School Examination Marks</h1>
          <p>Enter, manage and analyze student marks for school examinations.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigateTo('school-results')}>
            View Result Sheets
          </button>
          <button className="btn btn-primary" onClick={handleSaveMarks}>
            <Save size={15} />
            <span>Save Marks</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="filter-bar">
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Examination</label>
            <select className="select-field" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
              <option>Half Yearly Examination</option>
              <option>Unit Test 1</option>
              <option>Unit Test 2</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Class</label>
            <select className="select-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option>Class 10</option>
              <option>Class 9</option>
              <option>Class 8</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Section</label>
            <select className="select-field" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-secondary" onClick={handleDownloadTemplate} title="Download Excel template for offline entry">
            <Download size={14} />
            <span>Excel Template</span>
          </button>
        </div>
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">32</div>
            <div className="stat-footer">
              <span className="stat-subtext">Class 10 - Section A</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <BookOpen size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Subjects</div>
            <div className="stat-value">6</div>
            <div className="stat-footer">
              <span className="stat-subtext">All subjects</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Marks Entered</div>
            <div className="stat-value">100%</div>
            <div className="stat-footer">
              <span className="stat-subtext">32 of 32 students</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <TrendingUp size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Class Average</div>
            <div className="stat-value">78.4%</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +5%</span>
              <span className="stat-subtext">vs last exam</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Lowest Score</div>
            <div className="stat-value">42%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Manish Verma</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }}>
        {['Mathematics', 'Science', 'English', 'Social Studies', 'Telugu', 'Hindi'].map((sub) => (
          <button
            key={sub}
            className={`btn ${activeSubject === sub ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubject(sub)}
            style={{ borderRadius: '10px', fontSize: '13px' }}
          >
            <span>{sub}</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>(100 Marks)</span>
          </button>
        ))}
      </div>

      {/* Grid: Marks Table + Right Subject Analytics */}
      <div className="grid-split">
        
        {/* Marks Entry Table Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-title">Marks Entry — {activeSubject}</div>
              <span className="badge badge-success">32/32 Entered</span>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No.</th>
                  <th style={{ width: '120px' }}>Marks (100)</th>
                  <th>Grade</th>
                  <th>Percentage</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {marksData.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={row.avatar} alt={row.name} className="user-table-avatar" />
                        <span className="user-table-name">{row.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>{row.rollNo}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.marks}
                        onChange={(e) => handleMarksChange(row.id, e.target.value)}
                        style={{
                          width: '80px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontWeight: 700,
                          fontSize: '13.5px',
                          textAlign: 'center',
                          color: '#0F172A',
                        }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${row.grade.startsWith('A') ? 'badge-success' : row.grade.startsWith('B') ? 'badge-info' : 'badge-warning'}`}>
                        {row.grade}
                      </span>
                    </td>
                    <td><strong>{row.percentage}%</strong></td>
                    <td style={{ color: '#64748B', fontSize: '12px' }}>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Analytics Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Subject Analytics Donut */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Subject Analytics</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <DonutChart
                value={78}
                size={120}
                label="78.4%"
                sublabel="Average Score"
                color="#6366F1"
              />

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Highest Score</span>
                  <strong style={{ color: '#10B981' }}>96%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Lowest Score</span>
                  <strong style={{ color: '#EF4444' }}>42%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Pass Percentage</span>
                  <strong>94%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Students Passed</span>
                  <strong>30 / 32</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Grade Distribution Bar Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Grade Distribution</div>
            </div>
            <div className="card-body">
              <BarChart data={gradeDistribution} height={130} valueFormatter={(v) => `${v}`} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

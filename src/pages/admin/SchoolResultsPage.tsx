import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  X,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BarChart } from '../../components/charts/Charts';
import { MOCK_STUDENTS } from '../../data/mockData';
import { downloadCSV, downloadSampleDocument, triggerPrint } from '../../utils/demoActions';

export const SchoolResultsPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedExam, setSelectedExam] = useState('Half Yearly Examination');
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [selectedSection, setSelectedSection] = useState('A');
  const [activeReportStudent, setActiveReportStudent] = useState<any | null>(null);

  // Class performance per subject
  const subjectPerformanceData = [
    { label: 'Maths', value: 78, color: '#C7D2FE' },
    { label: 'Science', value: 82, color: '#C7D2FE' },
    { label: 'English', value: 76, color: '#C7D2FE' },
    { label: 'Social', value: 71, color: '#C7D2FE' },
    { label: 'Telugu', value: 79, color: '#6366F1' },
  ];

  // Full marks breakdown
  const studentResults = [
    { id: '1', name: 'Aditya Sharma', rollNo: '001', avatar: MOCK_STUDENTS[0].avatar, maths: 96, science: 92, english: 89, social: 94, telugu: 91, total: 462, pct: 92.4, grade: 'A+', result: 'Passed' },
    { id: '2', name: 'Bhavana Reddy', rollNo: '002', avatar: MOCK_STUDENTS[2].avatar, maths: 88, science: 85, english: 91, social: 87, telugu: 84, total: 435, pct: 87.0, grade: 'A', result: 'Passed' },
    { id: '3', name: 'Charan Kumar', rollNo: '003', avatar: MOCK_STUDENTS[3].avatar, maths: 76, science: 82, english: 78, social: 74, telugu: 80, total: 390, pct: 78.0, grade: 'B+', result: 'Passed' },
    { id: '4', name: 'Divya Nair', rollNo: '004', avatar: MOCK_STUDENTS[4].avatar, maths: 85, science: 79, english: 88, social: 81, telugu: 86, total: 419, pct: 83.8, grade: 'A', result: 'Passed' },
    { id: '5', name: 'Harshith Reddy', rollNo: '005', avatar: MOCK_STUDENTS[5].avatar, maths: 67, science: 71, english: 69, social: 65, telugu: 72, total: 344, pct: 68.8, grade: 'B', result: 'Passed' },
    { id: '6', name: 'Kavya Sri', rollNo: '006', avatar: MOCK_STUDENTS[1].avatar, maths: 91, science: 88, english: 86, social: 82, telugu: 89, total: 436, pct: 87.2, grade: 'A', result: 'Passed' },
    { id: '7', name: 'Manish Verma', rollNo: '007', avatar: MOCK_STUDENTS[6].avatar, maths: 42, science: 55, english: 48, social: 51, telugu: 46, total: 242, pct: 48.4, grade: 'C', result: 'Failed' },
    { id: '8', name: 'Nithya Sree', rollNo: '008', avatar: MOCK_STUDENTS[7].avatar, maths: 78, science: 84, english: 81, social: 79, telugu: 83, total: 405, pct: 81.0, grade: 'A', result: 'Passed' },
  ];

  const handleExportCSV = () => {
    const data = studentResults.map((s) => ({
      RollNo: s.rollNo,
      Name: s.name,
      Examination: selectedExam,
      Class: `${selectedClass} - ${selectedSection}`,
      Mathematics: s.maths,
      Science: s.science,
      English: s.english,
      SocialStudies: s.social,
      Telugu: s.telugu,
      TotalMarks: s.total,
      Percentage: `${s.pct}%`,
      Grade: s.grade,
      Result: s.result,
    }));
    downloadCSV(`School_Results_${selectedClass.replace(/\s+/g, '_')}_${selectedSection}.csv`, data);
    showToast(`Exported ${studentResults.length} student results to CSV`, 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Examinations</span>
            <span>›</span>
            <span>School Results</span>
            <span>›</span>
            <span>Results & Report Cards</span>
          </div>
          <h1>School Results & Report Cards</h1>
          <p>View results, generate report cards and analyze student performance.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => setActiveReportStudent(studentResults[0])}>
            <FileText size={15} />
            <span>Generate Report Card</span>
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
            </select>
          </div>
        </div>
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Award size={22} />
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
          <div className="stat-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Passed</div>
            <div className="stat-value">28</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">87.5%</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Failed</div>
            <div className="stat-value">4</div>
            <div className="stat-footer">
              <span className="stat-badge-change negative">12.5%</span>
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
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Highest Score</div>
            <div className="stat-value">96%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Aditya Sharma</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Results Table + Right Sample Report Card Card */}
      <div className="grid-split">
        
        {/* Table Column */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Student Results (32)</div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No.</th>
                  <th>Maths</th>
                  <th>Science</th>
                  <th>English</th>
                  <th>Social</th>
                  <th>Telugu</th>
                  <th>Total (500)</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th>Result</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {studentResults.map((st, idx) => (
                  <tr key={st.id} onClick={() => setActiveReportStudent(st)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>{st.rollNo}</td>
                    <td>{st.maths}</td>
                    <td>{st.science}</td>
                    <td>{st.english}</td>
                    <td>{st.social}</td>
                    <td>{st.telugu}</td>
                    <td><strong>{st.total}</strong></td>
                    <td>{st.pct}%</td>
                    <td><span className="badge badge-purple">{st.grade}</span></td>
                    <td>
                      <span className={`badge ${st.result === 'Passed' ? 'badge-success' : 'badge-danger'}`}>
                        {st.result}
                      </span>
                    </td>
                    <td>
                      <ChevronRight size={16} color="#94A3B8" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Class Performance & Sample Report Card Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Class Performance Bar Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Subject-wise Average</div>
            </div>
            <div className="card-body">
              <BarChart data={subjectPerformanceData} height={140} />
            </div>
          </div>

          {/* Sample Report Card Card */}
          <div className="card" style={{ border: '2px solid #E0E7FF' }}>
            <div className="card-header" style={{ background: '#F5F3FF' }}>
              <div className="card-title" style={{ color: '#4F46E5' }}>Sample Report Card</div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  triggerPrint();
                  showToast('Preparing printable Report Card PDF...', 'success');
                }}
              >
                <Printer size={13} />
                <span>Generate PDF</span>
              </button>
            </div>
            <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>Sri Sai Tuition Center</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366F1' }}>Half Yearly Examination</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Report Card (2026 - 2027)</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={MOCK_STUDENTS[0].avatar} alt="Aditya" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>Aditya Sharma</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>Class 10 - Section A | Roll: 001</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>Mathematics</span><strong>96/100 (A+)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>Science</span><strong>92/100 (A+)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>English</span><strong>89/100 (A)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>Social Studies</span><strong>94/100 (A+)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span>Telugu</span><strong>91/100 (A+)</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#ECFDF5', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>Total: 462 / 500 (92.4%)</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#065F46' }}>Result: PASSED</div>
                </div>
                <span className="badge badge-success" style={{ fontSize: '13px', padding: '4px 10px' }}>Grade A+</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Report Card Modal if a row is clicked */}
      {activeReportStudent && (
        <div className="modal-backdrop" onClick={() => setActiveReportStudent(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Student Report Card — {activeReportStudent.name}</h2>
              <button onClick={() => setActiveReportStudent(null)}><X size={20} color="#64748B" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: '#F8FAFC', borderRadius: '12px' }}>
                <img src={activeReportStudent.avatar} alt={activeReportStudent.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeReportStudent.name}</h3>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Roll No: {activeReportStudent.rollNo} • Class 10 - A • {selectedExam}</div>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Max Marks</th>
                    <th>Marks Obtained</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Mathematics</td><td>100</td><td><strong>{activeReportStudent.maths}</strong></td><td><span className="badge badge-success">A+</span></td></tr>
                  <tr><td>Science</td><td>100</td><td><strong>{activeReportStudent.science}</strong></td><td><span className="badge badge-success">A+</span></td></tr>
                  <tr><td>English</td><td>100</td><td><strong>{activeReportStudent.english}</strong></td><td><span className="badge badge-success">A</span></td></tr>
                  <tr><td>Social Studies</td><td>100</td><td><strong>{activeReportStudent.social}</strong></td><td><span className="badge badge-success">A+</span></td></tr>
                  <tr><td>Telugu</td><td>100</td><td><strong>{activeReportStudent.telugu}</strong></td><td><span className="badge badge-success">A+</span></td></tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#EEF2FF', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#4338CA' }}>Total Marks: {activeReportStudent.total} / 500</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#312E81' }}>Percentage: {activeReportStudent.pct}%</div>
                </div>
                <span className={`badge ${activeReportStudent.result === 'Passed' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '14px', padding: '6px 14px' }}>
                  {activeReportStudent.result}
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setActiveReportStudent(null)}>Close</button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadSampleDocument(
                    `Report_Card_${activeReportStudent.name.replace(/\s+/g, '_')}.txt`,
                    `REPORT CARD\nInstitution: Sri Sai Tuition Center\nStudent: ${activeReportStudent.name}\nRoll No: ${activeReportStudent.rollNo}\nExam: ${selectedExam}\nTotal: ${activeReportStudent.total}/500\nPercentage: ${activeReportStudent.pct}%\nResult: ${activeReportStudent.result}`
                  );
                  showToast(`Downloaded Report Card for ${activeReportStudent.name}`, 'success');
                }}
              >
                <Download size={14} />
                <span>Download Report</span>
              </button>
              <button className="btn btn-primary" onClick={() => { triggerPrint(); showToast('Printing report card...', 'success'); }}>
                <Printer size={15} />
                <span>Print Report Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

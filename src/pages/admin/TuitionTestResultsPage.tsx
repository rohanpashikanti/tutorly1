import React, { useState } from 'react';
import {
  Award,
  Download,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BarChart } from '../../components/charts/Charts';
import { MOCK_STUDENTS } from '../../data/mockData';
import { downloadCSV } from '../../utils/demoActions';

export const TuitionTestResultsPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedTest, setSelectedTest] = useState('Physics Unit Test 1');
  const [selectedClass, setSelectedClass] = useState('Class 10 - A');
  const [selectedSubject, setSelectedSubject] = useState('Physics');

  const scoreDist = [
    { label: 'A+', value: 8, color: '#A7F3D0' },
    { label: 'A', value: 7, color: '#BFDBFE' },
    { label: 'B+', value: 6, color: '#FDE68A' },
    { label: 'B', value: 4, color: '#FDBA74' },
    { label: 'C', value: 2, color: '#FCA5A5' },
    { label: 'D', value: 1, color: '#F87171' },
  ];

  const resultsList = [
    { id: '1', name: 'Aditya Sharma', rollNo: '001', avatar: MOCK_STUDENTS[0].avatar, marks: 96, pct: 96, grade: 'A+', rank: 1, result: 'Passed' },
    { id: '2', name: 'Kavya Sri', rollNo: '006', avatar: MOCK_STUDENTS[1].avatar, marks: 91, pct: 91, grade: 'A+', rank: 2, result: 'Passed' },
    { id: '3', name: 'Bhavana Reddy', rollNo: '002', avatar: MOCK_STUDENTS[2].avatar, marks: 88, pct: 88, grade: 'A', rank: 3, result: 'Passed' },
    { id: '4', name: 'Divya Nair', rollNo: '004', avatar: MOCK_STUDENTS[4].avatar, marks: 85, pct: 85, grade: 'A', rank: 4, result: 'Passed' },
    { id: '5', name: 'Charan Kumar', rollNo: '003', avatar: MOCK_STUDENTS[3].avatar, marks: 72, pct: 72, grade: 'B+', rank: 5, result: 'Passed' },
    { id: '6', name: 'Harshith Reddy', rollNo: '005', avatar: MOCK_STUDENTS[5].avatar, marks: 67, pct: 67, grade: 'B', rank: 6, result: 'Passed' },
    { id: '7', name: 'Nithya Sree', rollNo: '008', avatar: MOCK_STUDENTS[7].avatar, marks: 78, pct: 78, grade: 'B+', rank: 7, result: 'Passed' },
    { id: '8', name: 'Manish Verma', rollNo: '007', avatar: MOCK_STUDENTS[6].avatar, marks: 42, pct: 42, grade: 'C', rank: 8, result: 'Failed' },
  ];

  const handleExportCSV = () => {
    const data = resultsList.map((st) => ({
      Rank: `#${st.rank}`,
      RollNo: st.rollNo,
      StudentName: st.name,
      Test: selectedTest,
      Class: selectedClass,
      Subject: selectedSubject,
      MarksObtained: st.marks,
      Percentage: `${st.pct}%`,
      Grade: st.grade,
      Result: st.result,
    }));
    downloadCSV(`Tuition_Test_Results_${selectedTest.replace(/\s+/g, '_')}.csv`, data);
    showToast(`Exported ${resultsList.length} test results to CSV`, 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Tuition Tests</span>
            <span>›</span>
            <span>Test Results</span>
          </div>
          <h1>Tuition Test Results</h1>
          <p>View results, rank students, analyze performance and generate reports for tuition tests.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
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
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Subject</label>
            <select className="select-field" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option>Physics</option>
              <option>Mathematics</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple"><Users size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Students Appeared</div>
            <div className="stat-value">28</div>
            <div className="stat-footer"><span className="stat-subtext">out of 28 (100%)</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Passed</div>
            <div className="stat-value">26</div>
            <div className="stat-footer"><span className="stat-badge-change positive">92.9%</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><XCircle size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Failed</div>
            <div className="stat-value">2</div>
            <div className="stat-footer"><span className="stat-badge-change negative">7.1%</span></div>
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

      {/* Grid: Results Table + Right Insights */}
      <div className="grid-split">
        
        {/* Results Table Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Student Results (28)</div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No.</th>
                  <th>Marks (100)</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Rank</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {resultsList.map((st, idx) => (
                  <tr key={st.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>{st.rollNo}</td>
                    <td><strong>{st.marks}</strong></td>
                    <td>{st.pct}%</td>
                    <td><span className="badge badge-purple">{st.grade}</span></td>
                    <td>
                      <span style={{ fontWeight: 800, color: st.rank <= 3 ? '#6366F1' : '#475569' }}>
                        #{st.rank}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${st.result === 'Passed' ? 'badge-success' : 'badge-danger'}`}>
                        {st.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Score Distribution Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">Score Distribution</div></div>
            <div className="card-body"><BarChart data={scoreDist} height={140} valueFormatter={(v) => `${v}`} /></div>
          </div>

          {/* Top Performers Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top Performers</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#FEF3C7', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🥇</span>
                  <span style={{ fontWeight: 700, color: '#92400E', fontSize: '13px' }}>Aditya Sharma</span>
                </div>
                <span className="badge badge-success">96%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#F1F5F9', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🥈</span>
                  <span style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>Kavya Sri</span>
                </div>
                <span className="badge badge-success">91%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#FFFBEB', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🥉</span>
                  <span style={{ fontWeight: 700, color: '#B45309', fontSize: '13px' }}>Bhavana Reddy</span>
                </div>
                <span className="badge badge-success">88%</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

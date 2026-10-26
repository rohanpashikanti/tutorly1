import React, { useState } from 'react';
import {
  Download,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Award,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BarChart, DonutChart } from '../../components/charts/Charts';
import { MOCK_STUDENTS } from '../../data/mockData';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';

export const AttendanceReportsPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [selectedBatch, setSelectedBatch] = useState('Batch A');
  const [dateRange, setDateRange] = useState('1 Oct 2026 - 31 Oct 2026');

  // Class breakdown data
  const classBreakdown = [
    { label: 'Class 6', value: 92, color: '#C7D2FE' },
    { label: 'Class 7', value: 88, color: '#C7D2FE' },
    { label: 'Class 8', value: 81, color: '#C7D2FE' },
    { label: 'Class 9', value: 84, color: '#C7D2FE' },
    { label: 'Class 10', value: 86, color: '#6366F1' },
    { label: 'Class 11', value: 79, color: '#C7D2FE' },
    { label: 'Class 12', value: 83, color: '#C7D2FE' },
  ];

  const handleExportCSV = () => {
    const data = MOCK_STUDENTS.map((st, i) => ({
      RollNo: st.rollNo,
      Name: st.name,
      Class: selectedClass,
      Batch: selectedBatch,
      PresentDays: 26 - i,
      AbsentDays: 2 + i,
      LateDays: i % 2,
      AttendancePercentage: `${st.attendanceRate}%`,
      DateRange: dateRange,
    }));
    downloadCSV(`Attendance_Report_${selectedClass}_${selectedBatch}.csv`, data);
    showToast(`Exported attendance report for ${data.length} students to CSV`, 'success');
  };

  const handleExportPDF = () => {
    const rows = MOCK_STUDENTS.map((st, i) => ({
      rollNo: st.rollNo,
      name: st.name,
      classBatch: `${selectedClass} - ${selectedBatch}`,
      presentDays: 26 - i,
      absentDays: 2 + i,
      lateDays: i % 2,
      rate: `${st.attendanceRate}%`
    }));

    exportReportToPDF({
      title: 'Attendance Performance & Summary Report',
      subtitle: `Official attendance records for ${selectedClass} (${selectedBatch})`,
      metadata: [
        { label: 'Class', value: selectedClass },
        { label: 'Batch', value: selectedBatch },
        { label: 'Period', value: dateRange },
        { label: 'Total Students', value: String(MOCK_STUDENTS.length) }
      ],
      summaryStats: [
        { label: 'Overall Attendance', value: '86%' },
        { label: 'Total Present', value: '1,892' },
        { label: 'Total Absent', value: '248' },
        { label: 'Avg per Student', value: '85.7%' }
      ],
      columns: [
        { header: 'Roll No', key: 'rollNo', align: 'center' },
        { header: 'Student Name', key: 'name', align: 'left' },
        { header: 'Class & Batch', key: 'classBatch', align: 'left' },
        { header: 'Present Days', key: 'presentDays', align: 'center' },
        { header: 'Absent Days', key: 'absentDays', align: 'center' },
        { header: 'Late Days', key: 'lateDays', align: 'center' },
        { header: 'Attendance %', key: 'rate', align: 'center' }
      ],
      rows,
      filename: `Attendance_Report_${selectedClass}_${selectedBatch}.pdf`
    });

    showToast('Generated print-ready PDF for attendance report', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Attendance</span>
            <span>›</span>
            <span>Attendance Reports</span>
          </div>
          <h1>Attendance Reports</h1>
          <p>Detailed attendance reports and summaries across classes, batches and time periods.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF}>
            <Printer size={15} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Class</label>
            <select className="select-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option>Class 10</option>
              <option>Class 9</option>
              <option>Class 8</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Batch</label>
            <select className="select-field" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option>Batch A</option>
              <option>Batch B</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Subject</label>
            <select className="select-field">
              <option>All Subjects</option>
              <option>Mathematics</option>
              <option>Science</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Date Range</label>
            <input
              type="text"
              className="select-field"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => showToast('Filters applied', 'info')}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Overall Attendance</div>
            <div className="stat-value">86%</div>
            <div className="stat-footer">
              <span className="stat-subtext">1,892 of 2,200 classes</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Present Count</div>
            <div className="stat-value">1,892</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +5%</span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Absent Count</div>
            <div className="stat-value">248</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↓ -12%</span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Avg per Student</div>
            <div className="stat-value">85.7%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across 28 students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Class & Subject Breakdown Cards (Attendance Trend removed completely per requirement) */}
      <div className="grid-2-col" style={{ marginBottom: '20px' }}>
        {/* Attendance by Class */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Attendance by Class</div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>All Classes Summary</span>
          </div>
          <div className="card-body">
            <BarChart data={classBreakdown} height={170} />
          </div>
        </div>

        {/* Attendance by Subject */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Subject-wise Breakdown</div>
            <span className="badge badge-purple">{selectedClass}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <DonutChart value={86} size={110} label="86%" sublabel="Overall" color="#6366F1" />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mathematics</span><strong>92%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Science</span><strong>88%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>English</span><strong>84%</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Student-wise Table + Summary & Top/Needs Attention */}
      <div className="grid-split-balanced">
        
        {/* Student-wise Attendance Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Student-wise Attendance</div>
            <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
              <Download size={13} />
              <span>Export</span>
            </button>
          </div>

          <div className="table-container data-table-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No.</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_STUDENTS.map((st, i) => (
                  <tr key={st.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{i + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td>{st.rollNo}</td>
                    <td><span style={{ color: '#10B981', fontWeight: 600 }}>{26 - i}</span></td>
                    <td><span style={{ color: '#EF4444', fontWeight: 600 }}>{2 + i}</span></td>
                    <td><span style={{ color: '#F59E0B', fontWeight: 600 }}>{i % 2}</span></td>
                    <td>
                      <span className={`badge ${st.attendanceRate >= 85 ? 'badge-success' : 'badge-warning'}`}>
                        {st.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Attendance Performance Cards */}
          <div className="data-cards-mobile">
            {MOCK_STUDENTS.map((st, i) => (
              <div key={st.id} className="responsive-data-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={st.avatar} alt={st.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{st.name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>Roll #{st.rollNo}</div>
                    </div>
                  </div>
                  <span className={`badge ${st.attendanceRate >= 85 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '12px', padding: '3px 8px' }}>
                    {st.attendanceRate}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Present</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                      {26 - i} days
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Absent</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#EF4444', marginTop: '2px' }}>
                      {2 + i} days
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Late</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>
                      {i % 2} days
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary & Performers Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card">
            <div className="card-header">
              <div className="card-title">Attendance Summary</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Total Working Days</span>
                <strong>25</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Total Classes</span>
                <strong>2,200</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Total Present</span>
                <strong style={{ color: '#10B981' }}>1,892 (86%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Total Absent</span>
                <strong style={{ color: '#EF4444' }}>248 (11%)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#64748B' }}>Average per Student</span>
                <strong>85.7%</strong>
              </div>
            </div>
          </div>

          {/* Top Performers & Needs Attention */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Performance Insights</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Award size={14} />
                  <span>Top Attendance Performers</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>1. Aditya Sharma</span>
                    <strong style={{ color: '#10B981' }}>93%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. Harshith Reddy</span>
                    <strong style={{ color: '#10B981' }}>93%</strong>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <AlertTriangle size={14} />
                  <span>Needs Attention (Below 75%)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>1. Nithya Sree</span>
                    <strong style={{ color: '#EF4444' }}>72%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. Manish Verma</span>
                    <strong style={{ color: '#EF4444' }}>65%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

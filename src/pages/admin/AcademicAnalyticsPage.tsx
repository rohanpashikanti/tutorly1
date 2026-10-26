import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowUpRight,
  Filter,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LineTrendChart, BarChart, DonutChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';

export const AcademicAnalyticsPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedTestType, setSelectedTestType] = useState('All Tests (School + Tuition)');

  // Comparative trend: Tuition Tests vs School Examinations
  const performanceTrendData = [
    { label: 'Apr', line1: 68, line2: 60 },
    { label: 'May', line1: 72, line2: 65 },
    { label: 'Jun', line1: 76, line2: 70 },
    { label: 'Jul', line1: 74, line2: 68 },
    { label: 'Aug', line1: 78, line2: 72 },
    { label: 'Sep', line1: 82, line2: 74 },
    { label: 'Oct', line1: 85, line2: 78 },
    { label: 'Nov', line1: 84, line2: 76 },
    { label: 'Dec', line1: 88, line2: 80 },
  ];

  // Subject-wise performance (Class Avg)
  const subjectScores = [
    { label: 'Maths', value: 82, color: '#6366F1' },
    { label: 'Science', value: 78, color: '#6366F1' },
    { label: 'English', value: 76, color: '#6366F1' },
    { label: 'Social', value: 71, color: '#6366F1' },
    { label: 'Telugu', value: 79, color: '#6366F1' },
  ];

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Class', Value: selectedClass },
      { Metric: 'Subject', Value: selectedSubject },
      { Metric: 'TestType', Value: selectedTestType },
      { Metric: 'Total Students', Value: 32 },
      { Metric: 'Overall Pass Rate', Value: '92.9%' },
      { Metric: 'Average Score', Value: '78.4%' },
      { Metric: 'Top Performer', Value: 'Aditya Sharma (96%)' },
      { Metric: 'Maths Average', Value: '82%' },
      { Metric: 'Science Average', Value: '78%' },
      { Metric: 'English Average', Value: '76%' },
      { Metric: 'Social Average', Value: '71%' },
      { Metric: 'Telugu Average', Value: '79%' },
    ];
    downloadCSV(`Academic_Analytics_${selectedClass.replace(/\s+/g, '_')}.csv`, data);
    showToast('Exported academic analytics summary to CSV', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Analytics</span>
            <span>›</span>
            <span>Academic Analytics</span>
          </div>
          <h1>Academic Analytics</h1>
          <p>Get insights into student performance, attendance, and learning progress across all classes and tests.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export Analytics CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="filter-bar">
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Class</label>
            <select className="select-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option>All Classes</option>
              <option>Class 10</option>
              <option>Class 9</option>
              <option>Class 8</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Subject</label>
            <select className="select-field" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option>All Subjects</option>
              <option>Mathematics</option>
              <option>Science</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Test Type</label>
            <select className="select-field" value={selectedTestType} onChange={(e) => setSelectedTestType(e.target.value)}>
              <option>All Tests (School + Tuition)</option>
              <option>Tuition Tests Only</option>
              <option>School Exams Only</option>
            </select>
          </div>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => showToast('Analytics recomputed for selected filters', 'info')}>
          Apply Filters
        </button>
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple"><Users size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">32</div>
            <div className="stat-footer"><span className="stat-badge-change positive">↑ +12%</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Overall Pass Rate</div>
            <div className="stat-value">92.9%</div>
            <div className="stat-footer"><span className="stat-badge-change positive">↑ +6%</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><BarChart3 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Average Score</div>
            <div className="stat-value">78.4%</div>
            <div className="stat-footer"><span className="stat-badge-change positive">↑ +5%</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink"><Award size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Top Performer</div>
            <div className="stat-value" style={{ fontSize: '16px' }}>Aditya Sharma</div>
            <div className="stat-footer"><span className="stat-subtext">96% average</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Improved Students</div>
            <div className="stat-value">24</div>
            <div className="stat-footer"><span className="stat-badge-change positive">↑ +75%</span></div>
          </div>
        </div>
      </div>

      {/* Row 1: Comparative Trend + Subject-wise + Key Insights */}
      <div className="grid-hero-3" style={{ marginBottom: '24px' }}>
        
        {/* Comparative Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Performance Trend</div>
              <div className="card-subtitle">Tuition Tests vs School Examinations</div>
            </div>
            <span className="badge badge-purple">Monthly</span>
          </div>
          <div className="card-body">
            <LineTrendChart
              data={performanceTrendData}
              height={190}
              line1Label="Tuition Tests"
              line2Label="School Exams"
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', fontSize: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366F1' }} /> Tuition Tests</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EC4899' }} /> School Exams</span>
            </div>
          </div>
        </div>

        {/* Subject-wise Bar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Subject Performance</div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Class Average</span>
          </div>
          <div className="card-body">
            <BarChart data={subjectScores} height={190} />
          </div>
        </div>

        {/* Key Insights Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={16} color="#F59E0B" />
              <span>Key Insights</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
            <div style={{ padding: '8px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
              <strong style={{ color: '#065F46' }}>Performance Improved</strong>
              <p style={{ color: '#047857', fontSize: '11.5px', marginTop: '2px' }}>Overall class average increased by 5% compared to last term.</p>
            </div>
            <div style={{ padding: '8px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              <strong style={{ color: '#1E40AF' }}>24 Students Improved</strong>
              <p style={{ color: '#1D4ED8', fontSize: '11.5px', marginTop: '2px' }}>75% of students showed better scores than previous tests.</p>
            </div>
            <div style={{ padding: '8px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <strong style={{ color: '#92400E' }}>Maths Leading</strong>
              <p style={{ color: '#B45309', fontSize: '11.5px', marginTop: '2px' }}>Maths has the highest subject average (82%).</p>
            </div>
            <div style={{ padding: '8px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <strong style={{ color: '#991B1B' }}>Need Attention</strong>
              <p style={{ color: '#B91C1C', fontSize: '11.5px', marginTop: '2px' }}>4 students are consistently underperforming across subjects.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Class-wise Table + Score Distribution Donut */}
      <div className="grid-split">
        
        {/* Class-wise Performance Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Class-wise Performance</div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Students</th>
                  <th>Average Score</th>
                  <th>Pass Rate</th>
                  <th>Top Performer</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Class 8 - A</td>
                  <td>8</td>
                  <td><strong>82.4%</strong></td>
                  <td><span className="badge badge-success">100%</span></td>
                  <td>Kavya Sri (91%)</td>
                  <td><span style={{ color: '#10B981', fontWeight: 700 }}>↗ Improving</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Class 9 - A</td>
                  <td>7</td>
                  <td><strong>76.1%</strong></td>
                  <td><span className="badge badge-warning">85.7%</span></td>
                  <td>Manish Verma (88%)</td>
                  <td><span style={{ color: '#6366F1', fontWeight: 700 }}>→ Steady</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Class 10 - A</td>
                  <td>9</td>
                  <td><strong>78.6%</strong></td>
                  <td><span className="badge badge-success">88.9%</span></td>
                  <td>Aditya Sharma (96%)</td>
                  <td><span style={{ color: '#10B981', fontWeight: 700 }}>↗ Improving</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Class 10 - B</td>
                  <td>8</td>
                  <td><strong>74.2%</strong></td>
                  <td><span className="badge badge-warning">87.5%</span></td>
                  <td>Divya Nair (85%)</td>
                  <td><span style={{ color: '#6366F1', fontWeight: 700 }}>→ Steady</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Score Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Score Distribution</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <DonutChart value={78.4} size={120} label="78.4%" sublabel="Class Avg" color="#6366F1" />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>90 - 100</span><strong>28%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>80 - 89</span><strong>32%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>70 - 79</span><strong>21%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>60 - 69</span><strong>14%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Below 60</span><strong style={{ color: '#EF4444' }}>5%</strong></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

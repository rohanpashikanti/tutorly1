import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BarChart, DonutChart } from '../../components/charts/Charts';
import { Student } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';
import { api } from '../../api/client';
import { getStoredStudents } from '../../utils/storage';

export const AttendanceReportsPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedBatch, setSelectedBatch] = useState('All Batches');
  const [dateRange, setDateRange] = useState('1 Oct 2026 - 31 Oct 2026');
  const [students, setStudents] = useState<Student[]>(() => getStoredStudents());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reports, setReports] = useState<{
    overallRate: number;
    presentCount: number;
    absentCount: number;
    avgRate: number;
    classBreakdown: { label: string; value: number; color?: string }[];
  }>({
    overallRate: 0,
    presentCount: 0,
    absentCount: 0,
    avgRate: 0,
    classBreakdown: []
  });

  const loadData = useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [stuRes, repRes] = await Promise.all([
        api.students.list(activeInstitutionId).catch(() => ({ students: [] as Student[], total: 0 })),
        api.attendance.getReports(activeInstitutionId).catch(() => null)
      ]);
      setStudents(stuRes.students || []);

      if (repRes) {
        setReports({
          overallRate: repRes.overallRate || 0,
          presentCount: repRes.presentCount || 0,
          absentCount: repRes.absentCount || 0,
          avgRate: repRes.avgRate || 0,
          classBreakdown: repRes.classBreakdown || []
        });
      }
    } catch (err) {
      console.error('Failed to load attendance report:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load attendance reports');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClass === 'All Classes' || s.class === selectedClass;
    const matchesBatch = selectedBatch === 'All Batches' || s.batch === selectedBatch;
    return matchesClass && matchesBatch;
  });

  const handleExportCSV = () => {
    const data = filteredStudents.map((st) => ({
      RollNo: st.rollNo,
      Name: st.name,
      Class: st.class,
      Batch: st.batch,
      AttendancePercentage: `${st.attendanceRate}%`,
      DateRange: dateRange,
    }));
    downloadCSV(`Attendance_Report_${selectedClass}_${selectedBatch}.csv`, data);
    showToast(`Exported attendance report for ${data.length} students to CSV`, 'success');
  };

  const handleExportPDF = () => {
    const rows = filteredStudents.map((st) => ({
      rollNo: st.rollNo,
      name: st.name,
      classBatch: `${st.class} - ${st.batch}`,
      rate: `${st.attendanceRate}%`
    }));

    exportReportToPDF({
      title: 'Attendance Performance & Summary Report',
      subtitle: `Official attendance records for ${selectedClass} (${selectedBatch})`,
      metadata: [
        { label: 'Class', value: selectedClass },
        { label: 'Batch', value: selectedBatch },
        { label: 'Period', value: dateRange },
        { label: 'Total Students', value: String(filteredStudents.length) }
      ],
      summaryStats: [
        { label: 'Overall Attendance', value: `${reports.overallRate}%` },
        { label: 'Total Present', value: String(reports.presentCount) },
        { label: 'Total Absent', value: String(reports.absentCount) },
        { label: 'Avg per Student', value: `${reports.avgRate}%` }
      ],
      columns: [
        { header: 'Roll No', key: 'rollNo', align: 'center' },
        { header: 'Student Name', key: 'name', align: 'left' },
        { header: 'Class & Batch', key: 'classBatch', align: 'left' },
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

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

      {/* Filter Row */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
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
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Batch</label>
            <select className="select-field" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option>All Batches</option>
              <option>Batch A</option>
              <option>Batch B</option>
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
            <div className="stat-value">{isLoading ? '—' : `${reports.overallRate}%`}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Cumulative rate</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Present Count</div>
            <div className="stat-value">{isLoading ? '—' : reports.presentCount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Recorded attendances</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Absent Count</div>
            <div className="stat-value">{isLoading ? '—' : reports.absentCount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Recorded absences</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Avg per Student</div>
            <div className="stat-value">{isLoading ? '—' : `${reports.avgRate}%`}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across {filteredStudents.length} students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance by Class */}
      {reports.classBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div className="card-title">Attendance by Class</div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>All Classes Summary</span>
          </div>
          <div className="card-body">
            <BarChart data={reports.classBreakdown} height={170} />
          </div>
        </div>
      )}

      {/* Student Attendance Summary Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Student Attendance Breakdown ({filteredStudents.length})</div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Student Name</th>
                <th>Roll No.</th>
                <th>Class</th>
                <th>Batch</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                    <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                      No students found
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      No student records match the selected class and batch filters.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, i) => (
                  <tr key={st.id}>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{i + 1}</td>
                    <td>
                      <div className="user-table-cell">
                        <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                        <span className="user-table-name">{st.name}</span>
                      </div>
                    </td>
                    <td>{st.rollNo}</td>
                    <td>{st.class}</td>
                    <td>{st.batch}</td>
                    <td>
                      <span className={`badge ${st.attendanceRate >= 85 ? 'badge-success' : 'badge-warning'}`}>
                        {st.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

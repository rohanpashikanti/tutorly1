import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const ATTENDANCE_REPORT_PAGE_SIZE = 25;

export const AttendanceReportsPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedBatch, setSelectedBatch] = useState('All Batches');
  const [dateRange, setDateRange] = useState('1 Oct 2026 - 31 Oct 2026');
  const [students, setStudents] = useState<Student[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const studentRequestVersion = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [batchesList, setBatchesList] = useState<{ id: string; name: string }[]>([]);
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
    const requestVersion = ++studentRequestVersion.current;
    setIsLoading(true);
    setLoadError(null);
    setStudents([]);
    try {
      const [stuRes, repRes, overRes] = await Promise.all([
        api.students.list(activeInstitutionId, {
          page: studentPage,
          limit: ATTENDANCE_REPORT_PAGE_SIZE,
          class: selectedClass === 'All Classes' ? undefined : selectedClass,
          batch: selectedBatch === 'All Batches' ? undefined : selectedBatch,
        }),
        api.attendance.getReports(activeInstitutionId),
        api.academics.getOverview(activeInstitutionId)
      ]);
      if (requestVersion !== studentRequestVersion.current) return;
      if (stuRes.totalPages > 0 && studentPage > stuRes.totalPages) {
        setStudentPage(stuRes.totalPages);
        return;
      }
      if (stuRes.totalPages === 0 && studentPage !== 1) {
        setStudentPage(1);
        return;
      }
      setStudents(stuRes.students || []);
      setStudentTotal(stuRes.total || 0);
      setClassesList(overRes?.classes || []);
      setBatchesList(overRes?.batches || []);

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
      if (requestVersion !== studentRequestVersion.current) return;
      console.error('Failed to load attendance report:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load attendance reports');
    } finally {
      if (requestVersion === studentRequestVersion.current) setIsLoading(false);
    }
  }, [activeInstitutionId, studentPage, selectedClass, selectedBatch]);

  useEffect(() => {
    void loadData();
    return () => {
      studentRequestVersion.current += 1;
    };
  }, [loadData]);

  const filteredStudents = students;

  const getAllFilteredStudents = () => {
    if (!activeInstitutionId) throw new Error('Select an institution before exporting this report.');
    return api.students.listAll(activeInstitutionId, {
      class: selectedClass === 'All Classes' ? undefined : selectedClass,
      batch: selectedBatch === 'All Batches' ? undefined : selectedBatch,
    });
  };

  const handleExportCSV = async () => {
    if (!activeInstitutionId) return;
    try {
      const allStudents = await getAllFilteredStudents();
      const data = allStudents.map((st) => ({
        RollNo: st.rollNo,
        Name: st.name,
        Class: st.class,
        Batch: st.batch,
        AttendancePercentage: `${st.attendanceRate}%`,
        DateRange: dateRange,
      }));
      downloadCSV(`Attendance_Report_${selectedClass}_${selectedBatch}.csv`, data);
      showToast(`Exported attendance report for ${data.length} students to CSV`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export attendance report', 'error');
    }
  };

  const handleExportPDF = async () => {
    if (!activeInstitutionId) return;
    try {
    const allStudents = await getAllFilteredStudents();
    const rows = allStudents.map((st) => ({
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
        { label: 'Total Students', value: String(allStudents.length) }
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export attendance report', 'error');
    }
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
            <select className="select-field" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setStudentPage(1); }}>
              <option>All Classes</option>
              {classesList.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Batch</label>
            <select className="select-field" value={selectedBatch} onChange={(e) => { setSelectedBatch(e.target.value); setStudentPage(1); }}>
              <option>All Batches</option>
              {batchesList.map((b) => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
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
            <div className="stat-value">{isLoading ? '—' : (reports.presentCount + reports.absentCount > 0 ? `${reports.overallRate}%` : '—')}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{reports.presentCount + reports.absentCount > 0 ? 'Cumulative rate' : 'No attendance recorded yet'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Present Count</div>
            <div className="stat-value">{isLoading ? '—' : (reports.presentCount + reports.absentCount > 0 ? reports.presentCount : '—')}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{reports.presentCount + reports.absentCount > 0 ? 'Recorded attendances' : 'No sessions held'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Absent Count</div>
            <div className="stat-value">{isLoading ? '—' : (reports.presentCount + reports.absentCount > 0 ? reports.absentCount : '—')}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{reports.presentCount + reports.absentCount > 0 ? 'Recorded absences' : 'No sessions held'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Avg per Student</div>
            <div className="stat-value">{isLoading ? '—' : (reports.presentCount + reports.absentCount > 0 ? `${reports.avgRate}%` : '—')}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{reports.presentCount + reports.absentCount > 0 ? `Across ${studentTotal} students` : 'No records yet'}</span>
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
          <div className="card-title">Student Attendance Breakdown ({studentTotal})</div>
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
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{(studentPage - 1) * ATTENDANCE_REPORT_PAGE_SIZE + i + 1}</td>
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
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B' }}>
          <span>Showing {studentTotal === 0 ? 0 : (studentPage - 1) * ATTENDANCE_REPORT_PAGE_SIZE + 1}-{(studentPage - 1) * ATTENDANCE_REPORT_PAGE_SIZE + filteredStudents.length} of {studentTotal} students</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="btn btn-sm btn-secondary" disabled={isLoading || studentPage <= 1} onClick={() => setStudentPage((current) => current - 1)}>Previous</button>
            <span>{studentTotal === 0 ? '0 / 0' : `${studentPage} / ${Math.ceil(studentTotal / ATTENDANCE_REPORT_PAGE_SIZE)}`}</span>
            <button className="btn btn-sm btn-secondary" disabled={isLoading || studentPage >= Math.ceil(studentTotal / ATTENDANCE_REPORT_PAGE_SIZE)} onClick={() => setStudentPage((current) => current + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

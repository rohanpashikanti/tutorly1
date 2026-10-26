import React, { useState } from 'react';
import {
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/demoActions';

interface AttendanceRecord {
  id: string;
  date: string;
  day: string;
  batch: string;
  status: 'Present' | 'Absent' | 'Late' | 'Pending Verification';
  remarks?: string;
  month: string; // '2026-10' | '2026-09'
}

export const ParentAttendancePage: React.FC = () => {
  const { selectedChildId, setSelectedChildId, selectedChild, showToast } = useApp();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Absent' | 'Late'>('All');

  const isAditya = selectedChildId === 'stu-001';

  // Real chronological attendance records for Aditya (Class 10)
  const adityaAttendance: AttendanceRecord[] = [
    { id: 'att-1', date: '28 Oct 2026', day: 'Tuesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Full session attended', month: '2026-10' },
    { id: 'att-2', date: '27 Oct 2026', day: 'Monday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Active in class test', month: '2026-10' },
    { id: 'att-3', date: '25 Oct 2026', day: 'Saturday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Weekend doubt session', month: '2026-10' },
    { id: 'att-4', date: '24 Oct 2026', day: 'Friday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-5', date: '23 Oct 2026', day: 'Thursday', batch: 'Class 10 - Section A Morning', status: 'Late', remarks: 'Arrived 10 mins late', month: '2026-10' },
    { id: 'att-6', date: '22 Oct 2026', day: 'Wednesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-7', date: '21 Oct 2026', day: 'Tuesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-8', date: '20 Oct 2026', day: 'Monday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-9', date: '18 Oct 2026', day: 'Saturday', batch: 'Class 10 - Section A Morning', status: 'Absent', remarks: 'Parent informed (Fever)', month: '2026-10' },
    { id: 'att-10', date: '17 Oct 2026', day: 'Friday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-11', date: '16 Oct 2026', day: 'Thursday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'att-12', date: '15 Oct 2026', day: 'Wednesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Monthly test attended', month: '2026-10' },
    // September
    { id: 'att-13', date: '30 Sep 2026', day: 'Wednesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-09' },
    { id: 'att-14', date: '29 Sep 2026', day: 'Tuesday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Regular session', month: '2026-09' },
    { id: 'att-15', date: '28 Sep 2026', day: 'Monday', batch: 'Class 10 - Section A Morning', status: 'Present', remarks: 'Revision test', month: '2026-09' },
    { id: 'att-16', date: '26 Sep 2026', day: 'Saturday', batch: 'Class 10 - Section A Morning', status: 'Late', remarks: 'Traffic delay (8 mins)', month: '2026-09' }
  ];

  // Real chronological attendance records for Kavya (Class 9)
  const kavyaAttendance: AttendanceRecord[] = [
    { id: 'katt-1', date: '28 Oct 2026', day: 'Tuesday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'katt-2', date: '27 Oct 2026', day: 'Monday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'katt-3', date: '25 Oct 2026', day: 'Saturday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Science practical session', month: '2026-10' },
    { id: 'katt-4', date: '24 Oct 2026', day: 'Friday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Monthly test', month: '2026-10' },
    { id: 'katt-5', date: '23 Oct 2026', day: 'Thursday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'katt-6', date: '22 Oct 2026', day: 'Wednesday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'katt-7', date: '21 Oct 2026', day: 'Tuesday', batch: 'Class 9 - Section B Evening', status: 'Late', remarks: 'Arrived 15 mins late', month: '2026-10' },
    { id: 'katt-8', date: '20 Oct 2026', day: 'Monday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    { id: 'katt-9', date: '19 Oct 2026', day: 'Sunday', batch: 'Class 9 - Section B Evening', status: 'Absent', remarks: 'Family event', month: '2026-10' },
    { id: 'katt-10', date: '17 Oct 2026', day: 'Friday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-10' },
    // September
    { id: 'katt-11', date: '30 Sep 2026', day: 'Wednesday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-09' },
    { id: 'katt-12', date: '29 Sep 2026', day: 'Tuesday', batch: 'Class 9 - Section B Evening', status: 'Present', remarks: 'Regular session', month: '2026-09' }
  ];

  const childRecords = isAditya ? adityaAttendance : kavyaAttendance;

  // Filter records by month and status
  const filteredRecords = childRecords.filter((rec) => {
    const matchesMonth = selectedMonth === 'All' || rec.month === selectedMonth;
    const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
    return matchesMonth && matchesStatus;
  });

  // Month-wise counts
  const presentCount = childRecords.filter((r) => (selectedMonth === 'All' || r.month === selectedMonth) && r.status === 'Present').length;
  const absentCount = childRecords.filter((r) => (selectedMonth === 'All' || r.month === selectedMonth) && r.status === 'Absent').length;
  const lateCount = childRecords.filter((r) => (selectedMonth === 'All' || r.month === selectedMonth) && r.status === 'Late').length;

  const handleExportCSV = () => {
    const data = filteredRecords.map((r) => ({
      Date: r.date,
      Day: r.day,
      Class: r.batch,
      Status: r.status,
      Remarks: r.remarks || ''
    }));
    downloadCSV(`${selectedChild.name.replace(/\s+/g, '_')}_attendance.csv`, data);
    showToast(`Exported ${data.length} attendance records to CSV`, 'success');
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Present':
        return { bg: '#DCFCE7', color: '#166534', label: 'Present' };
      case 'Absent':
        return { bg: '#FEE2E2', color: '#991B1B', label: 'Absent' };
      case 'Late':
        return { bg: '#FEF3C7', color: '#92400E', label: 'Late' };
      default:
        return { bg: '#F1F5F9', color: '#475569', label: 'Incomplete Entry' };
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Parent Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Attendance</span>
          </div>
          <h1>Parent Attendance</h1>
          <p className="page-subtitle">
            Straightforward daily attendance history for your child. Review class presence and timings.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {/* Child Switcher & Month Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        {/* Child Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Student:</span>
          <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
            <button
              onClick={() => {
                setSelectedChildId('stu-001');
                showToast('Viewing Aditya Sharma (Class 10)', 'info');
              }}
              style={{
                border: 'none',
                background: isAditya ? '#FFFFFF' : 'transparent',
                color: isAditya ? '#4F46E5' : '#475569',
                fontWeight: isAditya ? 700 : 500,
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: isAditya ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Aditya Sharma (Class 10)
            </button>
            <button
              onClick={() => {
                setSelectedChildId('stu-002');
                showToast('Viewing Kavya Sharma (Class 9)', 'info');
              }}
              style={{
                border: 'none',
                background: !isAditya ? '#FFFFFF' : 'transparent',
                color: !isAditya ? '#4F46E5' : '#475569',
                fontWeight: !isAditya ? 700 : 500,
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: !isAditya ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Kavya Sharma (Class 9)
            </button>
          </div>
        </div>

        {/* Month Selector & Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            className="select-field"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '12.5px' }}
            aria-label="Select month"
          >
            <option value="2026-10">October 2026</option>
            <option value="2026-09">September 2026</option>
            <option value="All">All Months</option>
          </select>

          <select
            className="select-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 12px', fontSize: '12.5px' }}
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present Only</option>
            <option value="Absent">Absent Only</option>
            <option value="Late">Late Only</option>
          </select>
        </div>
      </div>

      {/* Simple Attendance Summary Banner */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '20px',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid #E2E8F0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#0F172A', fontWeight: 600 }}>
          <Calendar size={16} color="#6366F1" />
          <span>
            {selectedMonth === '2026-10' ? 'October 2026' : selectedMonth === '2026-09' ? 'September 2026' : 'Overall Period'} Summary:
          </span>
        </div>

        <div style={{ display: 'flex', gap: '14px', fontSize: '12.5px', fontWeight: 600 }}>
          <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            {presentCount} Days Present
          </span>
          <span style={{ color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            {lateCount} Days Late
          </span>
          <span style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            {absentCount} Days Absent
          </span>
        </div>
      </div>

      {/* Attendance History Card */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Attendance History ({filteredRecords.length})
            </h3>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Chronological log for {isAditya ? 'Aditya Sharma (Class 10)' : 'Kavya Sharma (Class 9)'}
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No attendance records found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                No records match the selected month or status filter.
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedMonth('2026-10');
                  setStatusFilter('All');
                }}
                style={{ marginTop: '8px' }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-responsive student-desktop-table">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    <th style={{ width: '110px' }}>Day</th>
                    <th>Class / Batch</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                    <th>Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => {
                    const badge = getStatusBadge(rec.status);
                    return (
                      <tr key={rec.id} style={{ height: '50px' }}>
                        <td style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {rec.date}
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#64748B' }}>
                          {rec.day}
                        </td>
                        <td style={{ fontSize: '13px', color: '#334155' }}>
                          {rec.batch}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.color,
                              fontWeight: 700,
                              fontSize: '11.5px',
                              padding: '3px 10px',
                              minWidth: '70px',
                              display: 'inline-block'
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#64748B' }}>
                          {rec.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Attendance Cards */}
            <div className="student-mobile-cards">
              {filteredRecords.map((rec) => {
                const badge = getStatusBadge(rec.status);
                return (
                  <div key={rec.id} className="student-mobile-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                          {rec.date} ({rec.day})
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          {rec.batch}
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
                          fontWeight: 700,
                          fontSize: '11px',
                          padding: '3px 8px'
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {rec.remarks && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#64748B',
                          paddingTop: '6px',
                          borderTop: '1px solid #F1F5F9'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#475569' }}>Note:</span> {rec.remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
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
import { api } from '../../api/client';
import { getStoredAttendanceSessions, getStoredStudents } from '../../utils/storage';
import { downloadCSV } from '../../utils/demoActions';

interface AttendanceRecord {
  id: string;
  date: string;
  day: string;
  batch: string;
  status: 'Present' | 'Absent' | 'Late' | 'Pending Verification';
  remarks?: string;
  month: string; // 'YYYY-MM'
}

export const ParentAttendancePage: React.FC = () => {
  const { selectedChildId, setSelectedChildId, activeInstitutionId, showToast } = useApp();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Absent' | 'Late'>('All');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.portals.getParent(activeInstitutionId)
      .then((res) => {
        if (res && res.children) {
          setChildren(res.children);
          if (res.children.length > 0 && !selectedChildId) {
            setSelectedChildId(res.children[0].id);
          }
        }
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load children');
        const stored = getStoredStudents();
        setChildren(stored);
      });
  }, [activeInstitutionId, selectedChildId, setSelectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  // Real chronological attendance records for active child
  const childRecords: AttendanceRecord[] = useMemo(() => {
    if (!activeChild) return [];
    const sessions = Object.values(getStoredAttendanceSessions());
    const records: AttendanceRecord[] = [];

    sessions.forEach((s) => {
      const match = s.records?.find(
        (r) => r.studentId === activeChild.id || r.studentName === activeChild.name
      );
      if (match) {
        let parsedDay = '—';
        try {
          parsedDay = new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' });
        } catch {
          // ignore
        }
        records.push({
          id: `${s.savedAt || s.date}-${activeChild.id}`,
          date: s.date,
          day: parsedDay,
          batch: `${s.className} - ${s.batch}`,
          status: match.status === 'Not Marked' ? 'Pending Verification' : match.status,
          remarks: match.remarks,
          month: s.date ? s.date.substring(0, 7) : 'All'
        });
      }
    });

    return records.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeChild]);

  // Extract available months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    childRecords.forEach((r) => {
      if (r.month && r.month !== 'All') set.add(r.month);
    });
    return Array.from(set).sort().reverse();
  }, [childRecords]);

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
    if (!activeChild) return;
    const data = filteredRecords.map((r) => ({
      Date: r.date,
      Day: r.day,
      Class: r.batch,
      Status: r.status,
      Remarks: r.remarks || ''
    }));
    downloadCSV(`${activeChild.name.replace(/\s+/g, '_')}_attendance.csv`, data);
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
            disabled={!activeChild || filteredRecords.length === 0}
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#991B1B', fontSize: '13px' }}>
          Unable to refresh portal children from server: {loadError}
        </div>
      )}

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
        {children.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Student:</span>
            <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChildId(c.id);
                    showToast(`Viewing ${c.name} (${c.class})`, 'info');
                  }}
                  style={{
                    border: 'none',
                    background: c.id === activeChild?.id ? '#FFFFFF' : 'transparent',
                    color: c.id === activeChild?.id ? '#4F46E5' : '#475569',
                    fontWeight: c.id === activeChild?.id ? 700 : 500,
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: c.id === activeChild?.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {c.name} ({c.class})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Month Selector & Status Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            className="select-field"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '12.5px' }}
            aria-label="Select month"
          >
            <option value="All">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
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

      {/* Attendance Summary Banner */}
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
            {selectedMonth === 'All' ? 'Overall Period' : selectedMonth} Summary:
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
              Chronological log for {activeChild ? `${activeChild.name} (${activeChild.class})` : 'Student'}
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
                {!activeChild
                  ? 'No child is linked to this parent account.'
                  : 'No attendance records match the selected month or status filter.'}
              </div>
              {(selectedMonth !== 'All' || statusFilter !== 'All') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedMonth('All');
                    setStatusFilter('All');
                  }}
                  style={{ marginTop: '8px' }}
                >
                  Reset Filters
                </button>
              )}
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

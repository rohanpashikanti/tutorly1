import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  ClipboardCheck,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  AlertTriangle,
  Download,
  Calendar,
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/demoActions';
import { getStoredAttendanceSessions, saveStoredAttendanceSession, AttendanceSession } from '../../utils/storage';
import { api } from '../../api/client';
import {
  getAttendanceIdempotencyAttempt,
  isCurrentAttendanceLoad,
  isCurrentAttendanceScope,
  runAttendanceSubmission,
} from '../../utils/attendanceSubmission';

import { ClassItem, BatchItem } from '../../types';

export type AttendanceStatus = 'P' | 'A' | 'L' | null;

interface StudentAttItem {
  id: string;
  name: string;
  rollNo: string;
  avatar: string;
  className: string;
  batch: string;
  status: AttendanceStatus;
  remarks: string;
}

export const AttendanceRegisterPage: React.FC = () => {
  const { role, showToast, activeInstitutionId, navigateTo } = useApp();

  // Dynamic classes and batches
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [batchesList, setBatchesList] = useState<BatchItem[]>([]);
  const [hasLoadedAcademics, setHasLoadedAcademics] = useState(false);

  // Selected Class, Batch & Date
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Attendance Records State
  const [students, setStudents] = useState<StudentAttItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [attemptedSaveWithIncomplete, setAttemptedSaveWithIncomplete] = useState<boolean>(false);
  const savingLock = React.useRef(false);
  const loadGeneration = React.useRef(0);
  const idempotencyAttempt = React.useRef<ReturnType<typeof getAttendanceIdempotencyAttempt> | null>(null);
  const attendanceScopeKey = JSON.stringify([activeInstitutionId, selectedClass, selectedBatch, selectedDate]);
  const currentScopeKey = React.useRef(attendanceScopeKey);
  const previousScopeKey = React.useRef(attendanceScopeKey);
  useLayoutEffect(() => {
    currentScopeKey.current = attendanceScopeKey;
    if (previousScopeKey.current !== attendanceScopeKey) {
      previousScopeKey.current = attendanceScopeKey;
      setStudents([]);
      setIsSaved(false);
    }
  }, [attendanceScopeKey]);

  useEffect(() => {
    if (!activeInstitutionId) return;
    api.academics.getOverview(activeInstitutionId)
      .then((res) => {
        const cls = res?.classes || [];
        const bth = res?.batches || [];
        setClassesList(cls);
        setBatchesList(bth);
        setHasLoadedAcademics(true);
        if (cls.length > 0) {
          setSelectedClass(cls[0].name);
          const firstClassBatches = bth.filter((b) => b.className === cls[0].name || b.classId === cls[0].id);
          setSelectedBatch(firstClassBatches[0]?.name || '');
        } else {
          setSelectedClass('');
          setSelectedBatch('');
        }
      })
      .catch((err) => {
        console.error('Failed to load classes/batches for attendance:', err);
        setHasLoadedAcademics(true);
      });
  }, [activeInstitutionId]);

  const loadAttendance = React.useCallback(async () => {
    const requestId = ++loadGeneration.current;
    const requestScope = JSON.stringify([activeInstitutionId, selectedClass, selectedBatch, selectedDate]);
    if (!activeInstitutionId || !selectedClass) {
      if (isCurrentAttendanceLoad(requestId, loadGeneration.current, requestScope, currentScopeKey.current)) {
        setStudents([]);
        setIsLoading(false);
      }
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.attendance.getRegister(activeInstitutionId, {
        date: selectedDate,
        class: selectedClass,
        batch: selectedBatch,
      });

      if (!isCurrentAttendanceLoad(requestId, loadGeneration.current, requestScope, currentScopeKey.current)) return;

      if (res && res.records) {
        setStudents(
          res.records.map((r) => ({
            id: r.studentId,
            name: r.studentName,
            rollNo: r.rollNo,
            avatar: r.avatar,
            className: selectedClass,
            batch: selectedBatch,
            status: r.status === 'Present' ? 'P' : r.status === 'Absent' ? 'A' : r.status === 'Late' ? 'L' : null,
            remarks: r.remarks || '',
          }))
        );
        setIsSaved(res.isSubmitted);
      } else {
        setStudents([]);
        setIsSaved(false);
      }
    } catch (err) {
      if (!isCurrentAttendanceLoad(requestId, loadGeneration.current, requestScope, currentScopeKey.current)) return;
      console.error('Error fetching attendance from D1:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      if (isCurrentAttendanceLoad(requestId, loadGeneration.current, requestScope, currentScopeKey.current)) setIsLoading(false);
    }
  }, [activeInstitutionId, selectedDate, selectedClass, selectedBatch]);

  useEffect(() => {
    void loadAttendance();
    return () => {
      loadGeneration.current += 1;
    };
  }, [loadAttendance]);

  // Filter students by active class & batch
  const currentCohort = students.filter(
    (s) => s.className === selectedClass && s.batch === selectedBatch
  );

  // Status counts (Exactly 3 selectable statuses: Present, Absent, Late)
  const presentCount = currentCohort.filter((s) => s.status === 'P').length;
  const absentCount = currentCohort.filter((s) => s.status === 'A').length;
  const lateCount = currentCohort.filter((s) => s.status === 'L').length;
  const unmarkedCount = currentCohort.filter((s) => s.status === null).length;
  const totalStudents = currentCohort.length;

  // Individual status update
  const setStudentStatus = (id: string, st: 'P' | 'A' | 'L') => {
    if (savingLock.current) return;
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, status: st } : s)));
    setIsSaved(false);
    setAttemptedSaveWithIncomplete(false);
  };

  // Remark update
  const setStudentRemark = (id: string, remark: string) => {
    if (savingLock.current) return;
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, remarks: remark } : s)));
    setIsSaved(false);
  };

  // Quick action: Select All Present
  const handleSelectAllPresent = () => {
    if (savingLock.current) return;
    setStudents(prev => prev.map(s => (
      s.className === selectedClass && s.batch === selectedBatch
        ? { ...s, status: 'P' }
        : s
    )));
    setIsSaved(false);
    setAttemptedSaveWithIncomplete(false);
    showToast(`Marked all ${totalStudents} students in ${selectedClass} - ${selectedBatch} as Present`, 'info');
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    if (savingLock.current) return;

    // Validate that no students remain unmarked
    if (unmarkedCount > 0) {
      setAttemptedSaveWithIncomplete(true);
      showToast(`Please assign an attendance status (Present, Absent, or Late) for all students before saving.`, 'error');
      return;
    }

    const statusMap: Record<'P' | 'A' | 'L', 'Present' | 'Absent' | 'Late'> = {
      'P': 'Present',
      'A': 'Absent',
      'L': 'Late'
    };

    if (!activeInstitutionId) {
      showToast('Select an institution before saving attendance.', 'error');
      return;
    }

    const scopeKey = attendanceScopeKey;
    const submission = {
      date: selectedDate,
      class: selectedClass,
      batch: selectedBatch,
      records: currentCohort.map((s) => ({
          studentId: s.id,
          status: statusMap[s.status as 'P' | 'A' | 'L'],
          remarks: s.remarks,
        })),
    };
    const fingerprint = JSON.stringify([activeInstitutionId, submission]);
    const attempt = getAttendanceIdempotencyAttempt(
      idempotencyAttempt.current,
      fingerprint,
      () => crypto.randomUUID(),
    );
    idempotencyAttempt.current = attempt;
    setAttemptedSaveWithIncomplete(false);

    await runAttendanceSubmission(
      savingLock,
      () => api.attendance.submit(activeInstitutionId, { ...submission, idempotencyKey: attempt.key }),
      {
        onStart: () => setIsSaving(true),
        onSuccess: () => {
          if (!isCurrentAttendanceScope(scopeKey, currentScopeKey.current)) return;
          setIsSaved(true);
          idempotencyAttempt.current = null;
          showToast(`Attendance for ${selectedClass} - ${selectedBatch} saved!`, 'success');
          void loadAttendance();
        },
        onFailure: (err) => {
          if (!isCurrentAttendanceScope(scopeKey, currentScopeKey.current)) return;
          showToast(err instanceof Error ? err.message : 'Failed to save attendance', 'error', {
            label: 'Retry',
            onClick: () => {
              if (isCurrentAttendanceScope(scopeKey, currentScopeKey.current)) void handleSaveAttendance();
            },
          });
        },
        onFinish: () => setIsSaving(false),
      },
    );
  };

  const handleExportCSV = () => {
    const data = currentCohort.map((s) => ({
      'Roll No': s.rollNo,
      'Student Name': s.name,
      Class: s.className,
      Batch: s.batch,
      Date: selectedDate,
      Status: s.status === 'P' ? 'Present' : s.status === 'A' ? 'Absent' : s.status === 'L' ? 'Late' : 'Unmarked',
      Remarks: s.remarks
    }));
    downloadCSV(`Attendance_${selectedClass.replace(/\s+/g, '')}_${selectedBatch.replace(/\s+/g, '')}_${selectedDate}.csv`, data);
    showToast(`Exported attendance for ${selectedClass} - ${selectedBatch} to CSV`, 'success');
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>{role === 'teacher' ? 'Teacher Portal' : 'Attendance'}</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Mark Attendance</span>
          </div>
          <h1>Attendance Register</h1>
          <p className="page-subtitle">
            Take attendance quickly for your assigned batch using Present, Absent, and Late controls.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            title="Download CSV"
          >
            <Download size={15} />
            <span className="desktop-only">Export CSV</span>
          </button>

          <button
            className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={handleSaveAttendance}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}
          >
            {isSaved ? <Check size={16} color="#10B981" /> : <Save size={16} />}
            <span>{isSaving ? 'Saving...' : (isSaved ? 'Saved' : 'Save Attendance')}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadAttendance()}>Retry</button>
        </div>
      )}

      {/* Primary Selector Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Class Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
              Class
            </label>
            <select
              className="select-field"
              disabled={isSaving}
              style={{ fontWeight: 600, fontSize: '13px', minWidth: '130px', padding: '8px 12px' }}
              value={selectedClass}
              onChange={(e) => {
                const newClass = e.target.value;
                setSelectedClass(newClass);
                const classBatches = batchesList.filter((b) => b.className === newClass || b.classId === classesList.find((c) => c.name === newClass)?.id);
                setSelectedBatch(classBatches[0]?.name || '');
              }}
            >
              {classesList.length === 0 ? (
                <option value="">No classes configured</option>
              ) : (
                classesList.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Batch Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
              Batch
            </label>
            {(() => {
              const availableBatches = batchesList.filter(
                (b) => b.className === selectedClass || b.classId === classesList.find((c) => c.name === selectedClass)?.id
              );
              return (
                <select
                  className="select-field"
                  disabled={isSaving}
                  style={{ fontWeight: 600, fontSize: '13px', minWidth: '130px', padding: '8px 12px' }}
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  {availableBatches.length === 0 ? (
                    <option value="">No batches configured</option>
                  ) : (
                    availableBatches.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))
                  )}
                </select>
              );
            })()}
          </div>

          {/* Date Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
              Attendance Date
            </label>
            <input
              type="date"
              className="select-field"
              disabled={isSaving}
              style={{ fontWeight: 600, fontSize: '13px', padding: '8px 12px' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isSaving}
            onClick={handleSelectAllPresent}
            style={{
              borderColor: '#10B981',
              color: '#065F46',
              backgroundColor: '#ECFDF5',
              fontWeight: 700,
              fontSize: '13px',
              padding: '8px 14px'
            }}
          >
            <CheckCircle2 size={16} color="#10B981" />
            <span>Select All Present</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} color="#6366F1" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total Roster</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>{totalStudents}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#065F46', fontWeight: 600 }}>Present</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#10B981' }}>{presentCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={18} color="#EF4444" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: 600 }}>Absent</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#EF4444' }}>{absentCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} color="#F59E0B" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>Late</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#F59E0B' }}>{lateCount}</div>
          </div>
        </div>
      </div>

      {/* Unmarked Warning Banner (if incomplete) */}
      {unmarkedCount > 0 && (
        <div className="att-unmarked-banner">
          <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>{unmarkedCount} student{unmarkedCount > 1 ? 's' : ''} not yet marked.</strong> Select Present, Absent, or Late for every student to complete the register.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isSaving}
            onClick={handleSelectAllPresent}
            style={{ fontSize: '11.5px', padding: '4px 8px', whiteSpace: 'nowrap' }}
          >
            Mark Rest Present
          </button>
        </div>
      )}

      {/* Student List Card */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
            {selectedClass} • {selectedBatch} Student Roster ({totalStudents})
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Tap <strong>Present</strong>, <strong>Absent</strong>, or <strong>Late</strong>
          </div>
        </div>

        {/* Desktop & Tablet Table-like List Layout */}
        <div className="attendance-desktop-table table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Roll</th>
                <th>Student</th>
                <th style={{ width: '260px', textAlign: 'center' }}>Attendance Status</th>
                <th>Remarks (Optional)</th>
              </tr>
            </thead>
            <tbody>
              {currentCohort.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    No students currently assigned to {selectedClass} - {selectedBatch}.
                  </td>
                </tr>
              ) : currentCohort.map((stu) => {
                const isUnmarked = stu.status === null;
                return (
                  <tr
                    key={stu.id}
                    className={attemptedSaveWithIncomplete && isUnmarked ? 'att-unmarked-row' : ''}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6366F1' }}>
                      {stu.rollNo}
                    </td>

                    <td>
                      <div className="user-table-cell">
                        <img
                          src={stu.avatar}
                          alt={stu.name}
                          className="user-table-avatar"
                          style={{ width: '34px', height: '34px' }}
                        />
                        <div>
                          <div className="user-table-name" style={{ fontSize: '13.5px', fontWeight: 600 }}>
                            {stu.name}
                          </div>
                          {isUnmarked && (
                            <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                              Status required
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div className="att-pill-group-3">
                        <button
                          type="button"
                          disabled={isSaving}
                          className={`att-pill-3 ${stu.status === 'P' ? 'active-P' : ''}`}
                          onClick={() => setStudentStatus(stu.id, 'P')}
                          aria-label={`Mark ${stu.name} Present`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          className={`att-pill-3 ${stu.status === 'A' ? 'active-A' : ''}`}
                          onClick={() => setStudentStatus(stu.id, 'A')}
                          aria-label={`Mark ${stu.name} Absent`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          className={`att-pill-3 ${stu.status === 'L' ? 'active-L' : ''}`}
                          onClick={() => setStudentStatus(stu.id, 'L')}
                          aria-label={`Mark ${stu.name} Late`}
                        >
                          Late
                        </button>
                      </div>
                    </td>

                    <td>
                      <input
                        type="text"
                        disabled={isSaving}
                        value={stu.remarks}
                        onChange={(e) => setStudentRemark(stu.id, e.target.value)}
                        placeholder="Add note..."
                        style={{
                          width: '100%',
                          maxWidth: '240px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px',
                          backgroundColor: '#FFFFFF'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile-Optimized List Layout (< 768px) */}
        <div className="attendance-mobile-list" style={{ padding: '12px' }}>
          {currentCohort.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
              No students in this batch.
            </div>
          ) : currentCohort.map((stu) => {
            const isUnmarked = stu.status === null;
            return (
              <div
                key={stu.id}
                className="att-student-card"
                style={{
                  borderLeft: isUnmarked && attemptedSaveWithIncomplete ? '4px solid #F59E0B' : '1px solid #E2E8F0',
                  backgroundColor: isUnmarked && attemptedSaveWithIncomplete ? '#FFFDF5' : '#FFFFFF'
                }}
              >
                <div className="att-student-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={stu.avatar}
                      alt={stu.name}
                      style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#0F172A' }}>{stu.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Roll #{stu.rollNo}</div>
                    </div>
                  </div>

                  <div>
                    {stu.status === 'P' && <span className="badge badge-success">Present</span>}
                    {stu.status === 'A' && <span className="badge badge-danger">Absent</span>}
                    {stu.status === 'L' && <span className="badge badge-warning">Late</span>}
                    {stu.status === null && (
                      <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        Required
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Large Touch Buttons (≥ 44px touch target) */}
                <div className="att-touch-btn-group-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    className={`att-touch-btn ${stu.status === 'P' ? 'active-P' : ''}`}
                    onClick={() => setStudentStatus(stu.id, 'P')}
                    aria-label={`Mark ${stu.name} Present`}
                  >
                    Present (P)
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    className={`att-touch-btn ${stu.status === 'A' ? 'active-A' : ''}`}
                    onClick={() => setStudentStatus(stu.id, 'A')}
                    aria-label={`Mark ${stu.name} Absent`}
                  >
                    Absent (A)
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    className={`att-touch-btn ${stu.status === 'L' ? 'active-L' : ''}`}
                    onClick={() => setStudentStatus(stu.id, 'L')}
                    aria-label={`Mark ${stu.name} Late`}
                  >
                    Late (L)
                  </button>
                </div>

                <div>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={stu.remarks}
                    onChange={(e) => setStudentRemark(stu.id, e.target.value)}
                    placeholder="Remarks (optional)..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Mobile Save Action Bar */}
        <div className="att-mobile-sticky-save">
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {presentCount} P • {absentCount} A • {lateCount} L
            </div>
            <div style={{ fontSize: '11px', color: unmarkedCount > 0 ? '#D97706' : '#64748B', fontWeight: 600 }}>
              {unmarkedCount > 0 ? `${unmarkedCount} Unmarked` : 'All marked'}
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={isSaving}
            aria-busy={isSaving}
            style={{ padding: '9px 18px', fontSize: '13.5px', fontWeight: 700 }}
            onClick={handleSaveAttendance}
          >
            {isSaving ? <Clock size={15} /> : <Save size={15} />}
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

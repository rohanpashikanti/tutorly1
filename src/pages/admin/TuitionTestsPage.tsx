import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Save,
  Download,
  Printer,
  CheckCircle2,
  BookOpen,
  Calendar,
  X,
  Check,
  Edit2,
  Trash2,
  Search
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TuitionTest, Student } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';
import { api } from '../../api/client';
import {
  getStoredTuitionTests,
  saveStoredTuitionTests,
  getStoredTuitionTestMarks,
  saveStoredTuitionTestMarks,
  getStoredStudents
} from '../../utils/storage';

interface StudentMarkEntry {
  id: string;
  name: string;
  rollNo: string;
  avatar: string;
  marks: number | '';
  maxMarks: number;
  remarks: string;
}

export const TuitionTestsPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<'Enter Marks' | 'View Results' | 'Tests Schedule'>('Enter Marks');

  // Stored tests & marks
  const [tests, setTests] = useState<TuitionTest[]>(() => getStoredTuitionTests());
  const [selectedTestId, setSelectedTestId] = useState<string>(() => tests[0]?.id || '');
  const [selectedBatch, setSelectedBatch] = useState('Batch A (Class 10)');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [maxMarks, setMaxMarks] = useState<number>(50);
  const [testDate, setTestDate] = useState('2026-10-28');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Student marks state
  const [studentMarks, setStudentMarks] = useState<StudentMarkEntry[]>([]);

  // Modal for new tuition test
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTestData, setNewTestData] = useState({
    name: '',
    type: 'Unit Test' as TuitionTest['type'],
    class: 'Class 10',
    batch: 'Batch A',
    subject: 'Physics',
    dateTime: '2026-10-28 10:00 AM',
    durationMinutes: 60,
    maxMarks: 50
  });

  // Load tests from API
  const refreshTests = async () => {
    if (!activeInstitutionId) return;
    try {
      const res = await api.assessments.listTests(activeInstitutionId);
      const list = res.tests || [];
      setTests(list);
      saveStoredTuitionTests(list);
      setLoadError(null);
      if (list.length > 0) {
        if (!list.some(t => t.id === selectedTestId)) {
          setSelectedTestId(list[0].id);
          setMaxMarks(list[0].maxMarks);
        }
      } else {
        setSelectedTestId('');
      }
    } catch (err: any) {
      console.error('Failed to load tuition tests:', err);
      setTests([]);
      setSelectedTestId('');
      setLoadError(err?.message || 'Failed to load tuition tests from database');
    }
  };

  useEffect(() => {
    void refreshTests();
  }, [activeInstitutionId]);

  // Load marks from API on test / batch / subject change
  useEffect(() => {
    let isCancelled = false;
    const fetchMarks = async () => {
      if (!selectedTestId) {
        setStudentMarks([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await api.assessments.getMarks(activeInstitutionId, selectedTestId);
        if (!isCancelled && res && res.marks && res.marks.length > 0) {
          const mapped: StudentMarkEntry[] = res.marks.map((m: any) => ({
            id: m.studentId,
            name: m.studentName,
            rollNo: m.rollNo,
            avatar: m.avatar,
            marks: m.marks !== null && m.marks !== undefined ? m.marks : '',
            maxMarks: m.maxMarks || maxMarks,
            remarks: m.remarks || ''
          }));
          setStudentMarks(mapped);
          setIsSaved(true);
          return;
        }
      } catch {
        // Fallback to local storage if API call fails
      }

      const allMarks = getStoredTuitionTestMarks();
      const storageKey = `${selectedTestId}_${selectedBatch}_${selectedSubject}`;
      const savedForSession = allMarks[storageKey];

      if (!isCancelled) {
        if (savedForSession && savedForSession.length > 0) {
          const mapped: StudentMarkEntry[] = savedForSession.map(m => ({
            id: m.studentId,
            name: m.studentName || 'Student',
            rollNo: m.rollNo || '',
            avatar: '',
            marks: m.marks,
            maxMarks: m.maxMarks || maxMarks,
            remarks: m.remarks || ''
          }));
          setStudentMarks(mapped);
          setIsSaved(true);
        } else {
          // Initialize blank marks from enrolled students
          const enrolled = getStoredStudents();
          const blankMarks: StudentMarkEntry[] = enrolled.map(st => ({
            id: st.id,
            name: st.name,
            rollNo: st.rollNo,
            avatar: st.avatar,
            marks: '',
            maxMarks,
            remarks: ''
          }));
          setStudentMarks(blankMarks);
          setIsSaved(false);
        }
        setIsLoading(false);
      }
    };

    fetchMarks();
    return () => { isCancelled = true; };
  }, [activeInstitutionId, selectedTestId, selectedBatch, selectedSubject, maxMarks]);

  const currentTest = tests.find(t => t.id === selectedTestId) || tests[0];

  const calculateGrade = (m: number | '', max: number) => {
    if (m === '' || isNaN(m)) return '—';
    const pct = (m / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
  };

  const handleMarkChange = (id: string, val: string) => {
    setIsSaved(false);
    const num = val === '' ? '' : Number(val);
    setStudentMarks(prev => prev.map(s => (s.id === id ? { ...s, marks: num } : s)));
  };

  const handleRemarksChange = (id: string, text: string) => {
    setIsSaved(false);
    setStudentMarks(prev => prev.map(s => (s.id === id ? { ...s, remarks: text } : s)));
  };

  const handleSaveMarks = async () => {
    const hasError = studentMarks.some(s => typeof s.marks === 'number' && (s.marks < 0 || s.marks > maxMarks));
    if (hasError) {
      showToast(`Validation error: Marks must be between 0 and maximum (${maxMarks})`, 'error');
      return;
    }

    try {
      await api.assessments.saveMarks(
        activeInstitutionId,
        selectedTestId,
        studentMarks.map(s => ({
          studentId: s.id,
          marks: typeof s.marks === 'number' ? s.marks : 0,
          remarks: s.remarks
        }))
      );
      setIsSaved(true);
      showToast(`Saved marks for ${currentTest?.name || 'Tuition Test'}!`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save marks to database', 'error');
    }
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestData.name.trim()) {
      showToast('Test name is required', 'error');
      return;
    }

    try {
      const res = await api.assessments.create(activeInstitutionId, {
        name: newTestData.name.trim(),
        type: 'tuition_test',
        class: newTestData.class,
        batch: newTestData.batch,
        subject: newTestData.subject,
        maxMarks: newTestData.maxMarks,
        durationMinutes: newTestData.durationMinutes,
        dateTime: newTestData.dateTime
      });
      if (res && res.assessmentId) {
        setSelectedTestId(res.assessmentId);
        setMaxMarks(newTestData.maxMarks);
      }
      await refreshTests();
      setShowCreateModal(false);
      showToast(`Created new Tuition Test: "${newTestData.name}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create test', 'error');
    }
  };

  const handleDeleteTest = async (id: string, name: string) => {
    try {
      await api.assessments.delete(activeInstitutionId, id);
      await refreshTests();
    } catch {
      const updated = tests.filter(t => t.id !== id);
      setTests(updated);
      saveStoredTuitionTests(updated);
      if (selectedTestId === id && updated.length > 0) {
        setSelectedTestId(updated[0].id);
      }
    }
    showToast(`Deleted Tuition Test: "${name}"`, 'info');
  };

  // Calculations
  const validMarks = studentMarks.filter(s => typeof s.marks === 'number').map(s => s.marks as number);
  const avgMarks = validMarks.length > 0 ? Math.round(validMarks.reduce((a, b) => a + b, 0) / validMarks.length) : 0;
  const avgPct = Math.round((avgMarks / maxMarks) * 100);
  const highestMark = validMarks.length > 0 ? Math.max(...validMarks) : 0;
  const passedCount = validMarks.filter(m => (m / maxMarks) >= 0.4).length;
  const passRate = validMarks.length > 0 ? Math.round((passedCount / validMarks.length) * 100) : 0;

  const handleExportCSV = () => {
    const data = studentMarks.map((s, idx) => ({
      Rank: idx + 1,
      RollNo: s.rollNo,
      Name: s.name,
      Test: currentTest?.name,
      Batch: selectedBatch,
      Subject: selectedSubject,
      Marks: s.marks,
      MaxMarks: maxMarks,
      Percentage: typeof s.marks === 'number' ? `${Math.round((s.marks / maxMarks) * 100)}%` : '—',
      Grade: calculateGrade(s.marks, maxMarks),
      Remarks: s.remarks
    }));
    downloadCSV(`Tuition_Test_${currentTest?.name?.replace(/\s+/g, '_') || 'Marks'}.csv`, data);
    showToast('Exported tuition test records to CSV', 'success');
  };

  const handleExportPDF = () => {
    const rows = studentMarks.map(s => {
      const num = typeof s.marks === 'number' ? s.marks : 0;
      const pct = Math.round((num / maxMarks) * 100);
      return {
        rollNo: s.rollNo,
        name: s.name,
        subject: selectedSubject,
        score: `${s.marks} / ${maxMarks}`,
        percentage: `${pct}%`,
        grade: calculateGrade(s.marks, maxMarks),
        remarks: s.remarks || '—'
      };
    });

    exportReportToPDF({
      title: `Tuition Test Results: ${currentTest?.name || 'Test'}`,
      subtitle: `Official Batch Performance Evaluation for ${selectedBatch} • ${selectedSubject}`,
      metadata: [
        { label: 'Test Name', value: currentTest?.name || '' },
        { label: 'Category', value: currentTest?.type || '' },
        { label: 'Batch/Class', value: selectedBatch },
        { label: 'Subject', value: selectedSubject },
        { label: 'Date', value: testDate }
      ],
      summaryStats: [
        { label: 'Batch Average', value: `${avgPct}%` },
        { label: 'Highest Score', value: `${highestMark}/${maxMarks}` },
        { label: 'Pass Rate', value: `${passRate}%` },
        { label: 'Students', value: String(studentMarks.length) }
      ],
      columns: [
        { header: 'Roll No', key: 'rollNo', align: 'center' },
        { header: 'Student Name', key: 'name', align: 'left' },
        { header: 'Subject', key: 'subject', align: 'left' },
        { header: 'Marks Obtained', key: 'score', align: 'center' },
        { header: 'Percentage', key: 'percentage', align: 'center' },
        { header: 'Grade', key: 'grade', align: 'center' },
        { header: 'Remarks', key: 'remarks', align: 'left' }
      ],
      rows,
      filename: `Tuition_Test_${currentTest?.name || 'Results'}.pdf`
    });

    showToast('Generated print-ready PDF for Tuition Test results', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Academic</span>
            <span>›</span>
            <span>Tuition Tests</span>
          </div>
          <h1>Tuition Tests</h1>
          <p>One unified module for tuition tests: schedule chapter tests, enter marks directly, and evaluate batch performance.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            <Printer size={15} />
            <span>Export PDF</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} />
            <span>New Test</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#B91C1C', fontSize: '13.5px' }}>{loadError}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => { setLoadError(null); void refreshTests(); }}>Retry</button>
        </div>
      )}

      {/* Primary Selector Bar (Consolidated test, batch, subject, date & marks) */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Select Tuition Test
            </label>
            <select
              className="select-field"
              value={selectedTestId}
              onChange={(e) => {
                setSelectedTestId(e.target.value);
                const t = tests.find(x => x.id === e.target.value);
                if (t && t.maxMarks) setMaxMarks(t.maxMarks);
              }}
              style={{ minWidth: '180px' }}
            >
              {tests.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Batch & Class
            </label>
            <select
              className="select-field"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <option value="Batch A (Class 10)">Batch A (Class 10)</option>
              <option value="Batch B (Class 10)">Batch B (Class 10)</option>
              <option value="Batch A (Class 9)">Batch A (Class 9)</option>
              <option value="Batch B (Class 8)">Batch B (Class 8)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Subject
            </label>
            <select
              className="select-field"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="Physics">Physics</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="English">English</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Max Marks
            </label>
            <input
              type="number"
              className="select-field"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value) || 50)}
              style={{ width: '80px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Test Date
            </label>
            <input
              type="date"
              className="select-field"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['Enter Marks', 'View Results', 'Tests Schedule'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 4 Stat Overview Badges */}
      <div className="stat-grid-4" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon purple">
            <BookOpen size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Batch Average</div>
            <div className="stat-value">{avgPct}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">Avg: {avgMarks} / {maxMarks}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Award size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Highest Score</div>
            <div className="stat-value">{highestMark} <span style={{ fontSize: '13px', color: '#64748B' }}>/ {maxMarks}</span></div>
            <div className="stat-footer">
              <span className="stat-subtext">{Math.round((highestMark / maxMarks) * 100)}% Top Scorer</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Pass Percentage</div>
            <div className="stat-value">{passRate}%</div>
            <div className="stat-footer">
              <span className="stat-subtext">{passedCount} of {studentMarks.length} students</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Calendar size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Test Category</div>
            <div className="stat-value" style={{ fontSize: '16px' }}>{currentTest?.type || 'Unit Test'}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{currentTest?.durationMinutes || 60} mins duration</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Enter Marks */}
      {activeTab === 'Enter Marks' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-title">Direct Student Marks Entry</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                {currentTest?.name} • {selectedBatch} • {selectedSubject} (Max Marks: {maxMarks})
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleSaveMarks}
              >
                {isSaved ? <Check size={15} color="#10B981" /> : <Save size={15} />}
                <span>{isSaved ? 'Marks Saved' : 'Save Marks'}</span>
              </button>
            </div>
          </div>

          <div className="table-container data-table-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th style={{ minWidth: '130px' }}>Marks Obtained</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>%</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Grade</th>
                  <th>Remarks / Evaluation Note</th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      {tests.length === 0 ? 'No tuition tests scheduled. Create a test to begin recording marks.' : 'No enrolled students found in this batch/class.'}
                    </td>
                  </tr>
                ) : (
                  studentMarks.map((st, idx) => {
                    const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                    const isExceeded = typeof st.marks === 'number' && (st.marks > maxMarks || st.marks < 0);
                    const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : '—';
                    const grade = calculateGrade(st.marks, maxMarks);

                    return (
                      <tr key={st.id}>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <div className="user-table-cell">
                            <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                            <span className="user-table-name">{st.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#64748B', fontSize: '13px' }}>{st.rollNo}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              value={st.marks}
                              onChange={(e) => handleMarkChange(st.id, e.target.value)}
                              placeholder="0"
                              style={{
                                width: '76px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: isExceeded ? '2px solid #EF4444' : '1px solid #CBD5E1',
                                background: isExceeded ? '#FEF2F2' : '#FFFFFF',
                                fontWeight: 700,
                                fontSize: '13px',
                                textAlign: 'center'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>/ {maxMarks}</span>
                          </div>
                          {isExceeded && (
                            <div style={{ fontSize: '10.5px', color: '#EF4444', fontWeight: 600, marginTop: '2px' }}>
                              Must be 0 - {maxMarks}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                          {pct !== '—' ? `${pct}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${grade === 'A+' || grade === 'A' ? 'badge-success' : grade === 'B+' || grade === 'B' ? 'badge-info' : 'badge-warning'}`}>
                            {grade}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={st.remarks}
                            onChange={(e) => handleRemarksChange(st.id, e.target.value)}
                            placeholder="Feedback on test..."
                            style={{ width: '100%', maxWidth: '240px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile-Optimized Marks Entry Cards */}
          <div className="data-cards-mobile">
            {studentMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                {tests.length === 0 ? 'No tuition tests scheduled.' : 'No enrolled students found in this batch/class.'}
              </div>
            ) : (
              studentMarks.map((st) => {
              const numMarks = typeof st.marks === 'number' ? st.marks : 0;
              const isExceeded = typeof st.marks === 'number' && (st.marks > maxMarks || st.marks < 0);
              const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : '—';
              const grade = calculateGrade(st.marks, maxMarks);

              return (
                <div key={st.id} className="responsive-data-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={st.avatar} alt={st.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{st.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>Roll #{st.rollNo}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {pct !== '—' && (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5' }}>{pct}%</span>
                      )}
                      <span className={`badge ${grade === 'A+' || grade === 'A' ? 'badge-success' : grade === 'B+' || grade === 'B' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                        {grade}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '85px' }}>Marks Obtained:</label>
                    <input
                      type="number"
                      min="0"
                      max={maxMarks}
                      value={st.marks}
                      onChange={(e) => handleMarkChange(st.id, e.target.value)}
                      placeholder="0"
                      style={{
                        width: '74px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: isExceeded ? '2px solid #EF4444' : '1px solid #CBD5E1',
                        background: isExceeded ? '#FEF2F2' : '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '14px',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>/ {maxMarks}</span>
                  </div>

                  <input
                    type="text"
                    value={st.remarks}
                    onChange={(e) => handleRemarksChange(st.id, e.target.value)}
                    placeholder="Evaluation note / remarks..."
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              );
            }))}
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: '#64748B' }}>
              Total {studentMarks.length} students enrolled in {selectedBatch}
            </span>
            <button className="btn btn-primary" onClick={handleSaveMarks}>
              <Save size={15} />
              <span>Save Marks</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: View Results */}
      {activeTab === 'View Results' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-title">Test Results & Merit Standing</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Performance analysis and ranking for {currentTest?.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Filter student..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px', width: '160px' }}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
                <Printer size={14} />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="table-container data-table-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>Rank</th>
                  <th>Student Name</th>
                  <th>Roll No</th>
                  <th>Subject</th>
                  <th style={{ textAlign: 'center' }}>Marks</th>
                  <th style={{ textAlign: 'center' }}>Percentage</th>
                  <th style={{ textAlign: 'center' }}>Grade</th>
                  <th style={{ textAlign: 'center' }}>Result</th>
                  <th>Teacher Remark</th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No test results found for this test and batch.
                    </td>
                  </tr>
                ) : (
                  [...studentMarks]
                    .filter(s => s.name.toLowerCase().includes(searchFilter.toLowerCase()) || s.rollNo.includes(searchFilter))
                    .sort((a, b) => {
                      const numA = typeof a.marks === 'number' ? a.marks : -1;
                      const numB = typeof b.marks === 'number' ? b.marks : -1;
                      return numB - numA;
                    })
                    .map((st, idx) => {
                      const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                      const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : 0;
                      const isPassed = pct >= 40;
                      const grade = calculateGrade(st.marks, maxMarks);

                      return (
                        <tr key={st.id}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: idx < 3 ? '#4F46E5' : '#64748B' }}>
                            #{idx + 1}
                          </td>
                          <td>
                            <div className="user-table-cell">
                              <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                              <span className="user-table-name">{st.name}</span>
                            </div>
                          </td>
                          <td style={{ color: '#64748B', fontSize: '13px' }}>{st.rollNo}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{selectedSubject}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                            {st.marks} / {maxMarks}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {pct}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${grade === 'A+' || grade === 'A' ? 'badge-success' : 'badge-info'}`}>
                              {grade}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${isPassed ? 'badge-success' : 'badge-danger'}`}>
                              {isPassed ? 'Passed' : 'Needs Support'}
                            </span>
                          </td>
                          <td style={{ color: '#64748B', fontSize: '12px' }}>
                            {st.remarks || 'Standard evaluation recorded'}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Results Cards */}
          <div className="data-cards-mobile">
            {studentMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                No test results found for this test and batch.
              </div>
            ) : (
              [...studentMarks]
                .filter(s => s.name.toLowerCase().includes(searchFilter.toLowerCase()) || s.rollNo.includes(searchFilter))
                .sort((a, b) => {
                  const numA = typeof a.marks === 'number' ? a.marks : -1;
                  const numB = typeof b.marks === 'number' ? b.marks : -1;
                  return numB - numA;
                })
                .map((st, idx) => {
                  const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                  const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : 0;
                  const isPassed = pct >= 40;
                  const grade = calculateGrade(st.marks, maxMarks);

                  return (
                    <div key={st.id} className="responsive-data-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '12px',
                              color: idx < 3 ? '#4F46E5' : '#64748B',
                              backgroundColor: idx < 3 ? '#EEF2FF' : '#F1F5F9',
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            Rank #{idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{st.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>Roll #{st.rollNo}</div>
                          </div>
                        </div>
                        <span className={`badge ${isPassed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {isPassed ? 'Passed' : 'Needs Support'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Score</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                            {st.marks} / {maxMarks}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Percentage</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
                            {pct}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Grade</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                            {grade}
                          </div>
                        </div>
                      </div>

                      {st.remarks && (
                        <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                          "{st.remarks}"
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Tests Schedule & History */}
      {activeTab === 'Tests Schedule' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">All Tuition Tests ({tests.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} />
              <span>Create Test</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Class / Batch</th>
                  <th>Subject</th>
                  <th>Date & Time</th>
                  <th>Max Marks</th>
                  <th>Status</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No tuition tests scheduled yet. Click "Create Test" to add one.
                    </td>
                  </tr>
                ) : (
                  tests.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>{t.name}</td>
                      <td><span className="badge badge-purple">{t.type}</span></td>
                      <td style={{ color: '#64748B' }}>{t.class} {t.batch ? `• ${t.batch}` : ''}</td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>{t.subject}</td>
                      <td>{t.dateTime}</td>
                      <td style={{ fontWeight: 700 }}>{t.maxMarks}</td>
                      <td>
                        <span className={`badge ${t.status === 'Completed' ? 'badge-success' : t.status === 'Ongoing' ? 'badge-warning' : 'badge-info'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            onClick={() => {
                              setSelectedTestId(t.id);
                              setMaxMarks(t.maxMarks);
                              setActiveTab('Enter Marks');
                            }}
                            title="Enter Marks"
                          >
                            <Edit2 size={13} color="#4F46E5" />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            onClick={() => handleDeleteTest(t.id, t.name)}
                            title="Delete Test"
                          >
                            <Trash2 size={13} color="#EF4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Schedule New Tuition Test</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleCreateTest}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Test Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physics Chapter 3 Test"
                    value={newTestData.name}
                    onChange={(e) => setNewTestData({ ...newTestData, name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Test Type
                    </label>
                    <select
                      value={newTestData.type}
                      onChange={(e) => setNewTestData({ ...newTestData, type: e.target.value as any })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Unit Test">Unit Test</option>
                      <option value="Chapter Test">Chapter Test</option>
                      <option value="Practice Test">Practice Test</option>
                      <option value="Model Test">Model Test</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Subject
                    </label>
                    <select
                      value={newTestData.subject}
                      onChange={(e) => setNewTestData({ ...newTestData, subject: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Physics">Physics</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="English">English</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Class
                    </label>
                    <select
                      value={newTestData.class}
                      onChange={(e) => setNewTestData({ ...newTestData, class: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Class 10">Class 10</option>
                      <option value="Class 9">Class 9</option>
                      <option value="Class 8">Class 8</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Batch
                    </label>
                    <select
                      value={newTestData.batch}
                      onChange={(e) => setNewTestData({ ...newTestData, batch: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Batch A">Batch A</option>
                      <option value="Batch B">Batch B</option>
                      <option value="Batch C">Batch C</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Maximum Marks
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newTestData.maxMarks}
                      onChange={(e) => setNewTestData({ ...newTestData, maxMarks: Number(e.target.value) || 50 })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      required
                      min="15"
                      value={newTestData.durationMinutes}
                      onChange={(e) => setNewTestData({ ...newTestData, durationMinutes: Number(e.target.value) || 60 })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Scheduled Date & Time
                  </label>
                  <input
                    type="text"
                    value={newTestData.dateTime}
                    placeholder="e.g. 2026-10-28 10:00 AM"
                    onChange={(e) => setNewTestData({ ...newTestData, dateTime: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Schedule Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

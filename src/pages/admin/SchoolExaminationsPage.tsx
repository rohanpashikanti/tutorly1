import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Save,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Award,
  Layers,
  BookOpen,
  Calendar,
  X,
  FileCheck,
  Check,
  Edit2,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Exam, ClassItem, SubjectItem } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';
import { api } from '../../api/client';
import { isValidAssessmentMarkInput, parseAssessmentMarkInput, summarizeAssessmentMarks, toAssessmentMarkSubmission } from '../../utils/assessmentMarks';
import {
  getStoredSchoolExams,
  saveStoredSchoolExams,
  getStoredSchoolExamMarks,
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

export const SchoolExaminationsPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<'Marks Entry' | 'Results & Ranking' | 'All Examinations'>('Marks Entry');

  // Dynamic classes and subjects
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);

  // Stored exams & marks
  const [exams, setExams] = useState<Exam[]>(() => getStoredSchoolExams());
  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [examDate, setExamDate] = useState('2026-10-25');
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Student marks entries
  const [studentMarks, setStudentMarks] = useState<StudentMarkEntry[]>([]);

  // Modal for new exam creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newExamData, setNewExamData] = useState({
    name: '',
    type: 'Term Exam' as Exam['type'],
    classes: '',
    startDate: '2026-11-10',
    endDate: '2026-11-20'
  });

  useEffect(() => {
    if (!activeInstitutionId) return;
    api.academics.getOverview(activeInstitutionId)
      .then((res) => {
        const cls = res?.classes || [];
        const sub = res?.subjects || [];
        setClassesList(cls);
        setSubjectsList(sub);
        setSelectedClass(prev => prev || cls[0]?.name || '');
        setSelectedSubject(prev => prev || sub[0]?.name || '');
        setNewExamData(d => ({ ...d, classes: cls[0]?.name || '' }));
      })
      .catch(() => {});
  }, [activeInstitutionId]);

  // Load exams from API
  const refreshExams = async () => {
    if (!activeInstitutionId) return;
    try {
      const res = await api.assessments.listExams(activeInstitutionId);
      const list = res.exams || [];
      setExams(list);
      saveStoredSchoolExams(list);
      setLoadError(null);
      if (list.length > 0) {
        if (!list.some(e => e.id === selectedExamId)) {
          setSelectedExamId(list[0].id);
        }
      } else {
        setSelectedExamId('');
      }
    } catch (err: any) {
      console.error('Failed to load exams:', err);
      setExams([]);
      setSelectedExamId('');
      setLoadError(err?.message || 'Failed to load school examinations from database');
    }
  };

  useEffect(() => {
    void refreshExams();
  }, [activeInstitutionId]);

  // Load marks from API on exam change
  useEffect(() => {
    let isCancelled = false;
    const fetchMarks = async () => {
      if (!selectedExamId) {
        setStudentMarks([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await api.assessments.getMarks(activeInstitutionId, selectedExamId);
        if (!isCancelled && res && res.marks && res.marks.length > 0) {
          const mapped: StudentMarkEntry[] = res.marks.map((m: any) => ({
            id: m.studentId,
            name: m.studentName,
            rollNo: m.rollNo,
            avatar: m.avatar,
            marks: m.marks !== null && m.marks !== undefined ? m.marks : '',
            maxMarks: m.maxMarks || 100,
            remarks: m.remarks || ''
          }));
          setStudentMarks(mapped);
          setIsSaved(true);
          return;
        }
      } catch {
        // Fallback to local storage if API call fails
      }

      const allMarks = getStoredSchoolExamMarks();
      const storageKey = `${selectedExamId}_${selectedClass}_${selectedSubject}`;
      const savedForSession = allMarks[storageKey];

      if (!isCancelled) {
        if (savedForSession && savedForSession.length > 0) {
          const mapped: StudentMarkEntry[] = savedForSession.map(m => ({
            id: m.studentId,
            name: m.studentName || 'Student',
            rollNo: m.rollNo || '',
            avatar: '',
            marks: typeof m.marks === 'number' ? m.marks : '',
            maxMarks: m.maxMarks || maxMarks,
            remarks: m.remarks || ''
          }));
          setStudentMarks(mapped);
          setIsSaved(true);
        } else {
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
  }, [activeInstitutionId, selectedExamId, selectedClass, selectedSubject, maxMarks]);

  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];

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
    const num = parseAssessmentMarkInput(val);
    setStudentMarks(prev => prev.map(s => (s.id === id ? { ...s, marks: num } : s)));
  };

  const handleRemarksChange = (id: string, text: string) => {
    setIsSaved(false);
    setStudentMarks(prev => prev.map(s => (s.id === id ? { ...s, remarks: text } : s)));
  };

  const handleSaveMarks = async () => {
    if (isSavingMarks) return;
    const hasError = studentMarks.some((student) => !isValidAssessmentMarkInput(student.marks, maxMarks));
    if (hasError) {
      showToast(`Please enter whole marks from 0 to ${maxMarks}`, 'error');
      return;
    }

    setIsSavingMarks(true);
    try {
      const result = await api.assessments.saveMarks(
        activeInstitutionId,
        selectedExamId,
        toAssessmentMarkSubmission(studentMarks),
      );
      if (!result.success) throw new Error('The server did not confirm that marks were saved.');
      setIsSaved(true);
      showToast(`Saved marks for ${currentExam?.name || 'Exam'} (${selectedSubject})!`, 'success');
    } catch (err) {
      setIsSaved(false);
      showToast(err instanceof Error ? err.message : 'Failed to save marks to database', 'error', {
        label: 'Retry',
        onClick: () => {
          void handleSaveMarks();
        }
      });
    } finally {
      setIsSavingMarks(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamData.name.trim()) {
      showToast('Exam name is required', 'error');
      return;
    }

    const examName = newExamData.name.trim();
    const tempId = `temp-${Date.now()}`;
    const previousExams = [...exams];
    const previousSelectedExamId = selectedExamId;

    const optimisticExam: Exam = {
      id: tempId,
      name: examName,
      type: newExamData.type,
      classes: newExamData.classes,
      subjectsCount: 5,
      startDate: newExamData.startDate,
      endDate: newExamData.endDate,
      status: 'Upcoming',
      academicYear: '2026-2027'
    };

    // Optimistically update screen immediately
    setExams(prev => [optimisticExam, ...prev]);
    setSelectedExamId(tempId);
    setShowCreateModal(false);
    showToast(`School Examination "${examName}" created!`, 'success');

    // Background server call
    api.assessments.create(activeInstitutionId, {
      name: examName,
      type: 'school_exam',
      class: newExamData.classes,
      dateTime: newExamData.startDate,
      maxMarks: 100
    }).then(res => {
      if (res && res.assessmentId) {
        setSelectedExamId(res.assessmentId);
      }
      void refreshExams();
    }).catch((err: any) => {
      // Rollback on failure
      setExams(previousExams);
      setSelectedExamId(previousSelectedExamId);
      showToast(err.message || 'Failed to create examination', 'error', {
        label: 'Retry',
        onClick: () => {
          setShowCreateModal(true);
        }
      });
    });
  };

  const handleDeleteExam = async (id: string, name: string) => {
    try {
      await api.assessments.delete(activeInstitutionId, id);
      await refreshExams();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const updated = exams.filter(e => e.id !== id);
      setExams(updated);
      saveStoredSchoolExams(updated);
      if (selectedExamId === id && updated.length > 0) {
        setSelectedExamId(updated[0].id);
      }
    }
    showToast(`Removed examination "${name}"`, 'info');
  };

  // Calculations for summary stats
  const marksSummary = summarizeAssessmentMarks(studentMarks.map((student) => student.marks), maxMarks);
  const { enteredCount: validMarksCount, averageMarks: avgMarks, averagePercent: avgPct, highestMark, passRate } = marksSummary;
  const passedCount = studentMarks.filter((student) => typeof student.marks === 'number' && (student.marks / maxMarks) * 100 >= 40).length;
  const getStudentRank = (student: StudentMarkEntry) => {
    const score = student.marks;
    return typeof score === 'number'
      ? studentMarks.filter((other) => typeof other.marks === 'number' && other.marks > score).length + 1
      : null;
  };

  const handleExportCSV = () => {
    const data = studentMarks.map((s, idx) => ({
      Rank: idx + 1,
      RollNo: s.rollNo,
      Name: s.name,
      Examination: currentExam?.name,
      Class: selectedClass,
      Subject: selectedSubject,
      MarksObtained: s.marks,
      MaxMarks: maxMarks,
      Percentage: typeof s.marks === 'number' ? `${Math.round((s.marks / maxMarks) * 100)}%` : '—',
      Grade: calculateGrade(s.marks, maxMarks),
      Remarks: s.remarks
    }));
    downloadCSV(`School_Exam_${selectedSubject}_${selectedClass.replace(/\s+/g, '_')}.csv`, data);
    showToast(`Exported marks to CSV`, 'success');
  };

  const handleExportPDF = () => {
    const rows = studentMarks.map(s => {
      return {
        rollNo: s.rollNo,
        name: s.name,
        subject: selectedSubject,
        score: s.marks === '' ? '—' : `${s.marks} / ${maxMarks}`,
        percentage: s.marks === '' ? '—' : `${Math.round((s.marks / maxMarks) * 100)}%`,
        grade: calculateGrade(s.marks, maxMarks),
        remarks: s.remarks || '—'
      };
    });

    exportReportToPDF({
      title: `School Examination Results: ${currentExam?.name || 'Exam'}`,
      subtitle: `Official assessment sheet for ${selectedClass} • ${selectedSubject}`,
      metadata: [
        { label: 'Exam', value: currentExam?.name || '' },
        { label: 'Type', value: currentExam?.type || '' },
        { label: 'Class', value: selectedClass },
        { label: 'Subject', value: selectedSubject },
        { label: 'Exam Date', value: examDate }
      ],
      summaryStats: [
        { label: 'Class Average', value: avgPct === null ? '—' : `${avgPct}%` },
        { label: 'Highest Score', value: highestMark === null ? '—' : `${highestMark}/${maxMarks}` },
        { label: 'Pass Rate', value: passRate === null ? '—' : `${passRate}%` },
        { label: 'Total Students', value: String(studentMarks.length) }
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
      filename: `School_Exam_Report_${currentExam?.name || 'Results'}.pdf`
    });

    showToast('Generated print-ready PDF for School Examination results', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Academic</span>
            <span>›</span>
            <span>School Examinations</span>
          </div>
          <h1>School Examinations</h1>
          <p>Consolidated school examination management: schedule exams, enter student marks, and view published results in one place.</p>
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
            <span>New Exam</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#B91C1C', fontSize: '13.5px' }}>{loadError}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => { setLoadError(null); void refreshExams(); }}>Retry</button>
        </div>
      )}

      {/* Primary Selector Bar (Consolidated exam, class, subject & marks in one step) */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Select Examination
            </label>
            <select
              className="select-field"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              {exams.length === 0 ? (
                <option value="">No examinations created</option>
              ) : (
                exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Class / Grade
            </label>
            <select
              className="select-field"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classesList.length === 0 ? (
                <option value="">No classes configured</option>
              ) : (
                classesList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))
              )}
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
              {subjectsList.length === 0 ? (
                <option value="">No subjects configured</option>
              ) : (
                subjectsList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))
              )}
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
              onChange={(e) => setMaxMarks(Number(e.target.value) || 100)}
              style={{ width: '80px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
              Exam Date
            </label>
            <input
              type="date"
              className="select-field"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['Marks Entry', 'Results & Ranking', 'All Examinations'] as const).map((tab) => (
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
            <div className="stat-label">Class Average</div>
            <div className="stat-value">{avgPct === null ? '—' : `${avgPct}%`}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{avgMarks === null ? 'No results recorded' : `Avg: ${avgMarks} / ${maxMarks}`}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Award size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Highest Score</div>
            <div className="stat-value">{highestMark === null ? '—' : `${highestMark} / ${maxMarks}`}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{highestMark === null ? 'No marks recorded' : `${Math.round((highestMark / maxMarks) * 100)}% Top Marks`}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Pass Percentage</div>
            <div className="stat-value">{passRate === null ? '—' : `${passRate}%`}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{validMarksCount > 0 ? `${passedCount} of ${validMarksCount} entered marks` : 'No results recorded'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Layers size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Exam Status</div>
            <div className="stat-value" style={{ fontSize: '17px' }}>{currentExam ? currentExam.status : 'No exam scheduled'}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{currentExam ? (currentExam.academicYear || 'Active Session') : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Marks Entry */}
      {activeTab === 'Marks Entry' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-title">Direct Student Marks Entry</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                {currentExam?.name} • {selectedClass} • {selectedSubject} (Max Marks: {maxMarks})
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleSaveMarks}
                disabled={isSavingMarks}
              >
                {isSavingMarks ? <Save size={15} /> : isSaved ? <Check size={15} color="#10B981" /> : <Save size={15} />}
                <span>{isSavingMarks ? 'Saving…' : isSaved ? 'Marks Saved' : 'Save Marks'}</span>
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
                      {exams.length === 0 ? 'No school examinations scheduled. Schedule an exam to begin recording marks.' : 'No enrolled students found in this class.'}
                    </td>
                  </tr>
                ) : (
                  studentMarks.map((st, idx) => {
                    const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                    const isExceeded = !isValidAssessmentMarkInput(st.marks, maxMarks);
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
                              step="1"
                              placeholder="—"
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
                            placeholder="Add teacher note..."
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

          {/* Mobile Marks Entry Cards */}
          <div className="data-cards-mobile">
            {studentMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                {exams.length === 0 ? 'No school examinations scheduled.' : 'No enrolled students found in this class.'}
              </div>
            ) : (
              studentMarks.map((st) => {
              const numMarks = typeof st.marks === 'number' ? st.marks : 0;
              const isExceeded = !isValidAssessmentMarkInput(st.marks, maxMarks);
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
                      step="1"
                      placeholder="—"
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
                    placeholder="Teacher evaluation note..."
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
              Showing {studentMarks.length} students enrolled in {selectedClass}
            </span>
            <button className="btn btn-primary" onClick={handleSaveMarks} disabled={isSavingMarks}>
              <Save size={15} />
              <span>{isSavingMarks ? 'Saving…' : 'Save All Marks'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Results & Ranking */}
      {activeTab === 'Results & Ranking' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="card-title">Class Performance & Ranking</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Rank standings based on entered assessment results for {currentExam?.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
                <Printer size={14} />
                <span>Print Report</span>
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
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Evaluation Note</th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No exam results found for this examination and class.
                    </td>
                  </tr>
                ) : (
                  [...studentMarks]
                    .sort((a, b) => {
                      const numA = typeof a.marks === 'number' ? a.marks : -1;
                      const numB = typeof b.marks === 'number' ? b.marks : -1;
                      return numB - numA;
                    })
                    .map((st) => {
                      const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                      const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : null;
                      const isPassed = pct !== null && pct >= 40;
                      const rank = getStudentRank(st);
                      const grade = calculateGrade(st.marks, maxMarks);

                      return (
                        <tr key={st.id}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: rank !== null && rank <= 3 ? '#4F46E5' : '#64748B' }}>
                            {rank === null ? '—' : `#${rank}`}
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
                            {st.marks === '' ? '—' : `${st.marks} / ${maxMarks}`}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {pct === null ? '—' : `${pct}%`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${grade === 'A+' || grade === 'A' ? 'badge-success' : 'badge-info'}`}>
                              {grade}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${pct === null ? 'badge-info' : isPassed ? 'badge-success' : 'badge-danger'}`}>
                              {pct === null ? 'Not graded' : isPassed ? 'Passed' : 'Needs Support'}
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

          {/* Mobile Exam Results Cards */}
          <div className="data-cards-mobile">
            {studentMarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', background: '#F8FAFC', borderRadius: '8px' }}>
                No exam results found for this examination and class.
              </div>
            ) : (
              [...studentMarks]
                .sort((a, b) => {
                  const numA = typeof a.marks === 'number' ? a.marks : -1;
                  const numB = typeof b.marks === 'number' ? b.marks : -1;
                  return numB - numA;
                })
                .map((st) => {
                  const numMarks = typeof st.marks === 'number' ? st.marks : 0;
                  const pct = typeof st.marks === 'number' ? Math.round((numMarks / maxMarks) * 100) : null;
                  const isPassed = pct !== null && pct >= 40;
                  const rank = getStudentRank(st);
                  const grade = calculateGrade(st.marks, maxMarks);

                  return (
                    <div key={st.id} className="responsive-data-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '12px',
                              color: rank !== null && rank <= 3 ? '#4F46E5' : '#64748B',
                              backgroundColor: rank !== null && rank <= 3 ? '#EEF2FF' : '#F1F5F9',
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            {rank === null ? 'Not ranked' : `Rank #${rank}`}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{st.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748B' }}>Roll #{st.rollNo}</div>
                          </div>
                        </div>
                        <span className={`badge ${pct === null ? 'badge-info' : isPassed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {pct === null ? 'Not graded' : isPassed ? 'Passed' : 'Needs Support'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Score</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                            {st.marks === '' ? '—' : `${st.marks} / ${maxMarks}`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Percentage</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#4F46E5', marginTop: '2px' }}>
                            {pct === null ? '—' : `${pct}%`}
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

      {/* Tab 3: All Scheduled Examinations */}
      {activeTab === 'All Examinations' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">School Examinations Schedule</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} />
              <span>Schedule Examination</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam Name</th>
                  <th>Type</th>
                  <th>Classes</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Academic Year</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No school examinations scheduled yet. Click "Schedule Examination" to add one.
                    </td>
                  </tr>
                ) : (
                  exams.map((ex) => (
                    <tr key={ex.id}>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>{ex.name}</td>
                      <td><span className="badge badge-purple">{ex.type}</span></td>
                      <td style={{ color: '#64748B' }}>{ex.classes}</td>
                      <td>{ex.startDate}</td>
                      <td>{ex.endDate}</td>
                      <td>
                        <span className={`badge ${ex.status === 'Completed' ? 'badge-success' : ex.status === 'Ongoing' ? 'badge-warning' : 'badge-info'}`}>
                          {ex.status}
                        </span>
                      </td>
                      <td style={{ color: '#64748B', fontSize: '12px' }}>{ex.academicYear}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            onClick={() => {
                              setSelectedExamId(ex.id);
                              setActiveTab('Marks Entry');
                            }}
                            title="Enter Marks"
                          >
                            <Edit2 size={13} color="#4F46E5" />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            onClick={() => handleDeleteExam(ex.id, ex.name)}
                            title="Delete Exam"
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

      {/* Schedule Exam Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Schedule School Examination</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowCreateModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleCreateExam}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Examination Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit Test 2 / Half Yearly Examination"
                    value={newExamData.name}
                    disabled={isSubmitting}
                    onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Exam Type
                    </label>
                    <select
                      value={newExamData.type}
                      disabled={isSubmitting}
                      onChange={(e) => setNewExamData({ ...newExamData, type: e.target.value as any })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Unit Test">Unit Test</option>
                      <option value="Term Exam">Term Exam</option>
                      <option value="Pre-Final">Pre-Final</option>
                      <option value="Final">Final</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Classes Covered
                    </label>
                    <select
                      value={newExamData.classes}
                      disabled={isSubmitting}
                      onChange={(e) => setNewExamData({ ...newExamData, classes: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      {classesList.length === 0 ? (
                        <option value="">No classes configured</option>
                      ) : (
                        classesList.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newExamData.startDate}
                      disabled={isSubmitting}
                      onChange={(e) => setNewExamData({ ...newExamData, startDate: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newExamData.endDate}
                      min={newExamData.startDate}
                      disabled={isSubmitting}
                      onChange={(e) => setNewExamData({ ...newExamData, endDate: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

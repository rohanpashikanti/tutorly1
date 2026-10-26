import React, { useState, useMemo } from 'react';
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
import {
  getStoredStudents,
  getStoredSchoolExams,
  getStoredSchoolExamMarks,
  getStoredTuitionTests,
  getStoredTuitionTestMarks,
  getStoredClasses
} from '../../utils/storage';
import { downloadCSV } from '../../utils/demoActions';

export const AcademicAnalyticsPage: React.FC = () => {
  const { showToast } = useApp();
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedTestType, setSelectedTestType] = useState('All Tests (School + Tuition)');

  const students = useMemo(() => getStoredStudents(), []);
  const schoolExams = useMemo(() => getStoredSchoolExams(), []);
  const schoolExamMarks = useMemo(() => getStoredSchoolExamMarks(), []);
  const tuitionTests = useMemo(() => getStoredTuitionTests(), []);
  const tuitionTestMarks = useMemo(() => getStoredTuitionTestMarks(), []);
  const classesList = useMemo(() => getStoredClasses(), []);

  // Filter students by selected class
  const filteredStudents = useMemo(() => {
    if (selectedClass === 'All Classes') return students;
    return students.filter((s) => s.class === selectedClass || s.class.includes(selectedClass));
  }, [students, selectedClass]);

  // Aggregate all recorded scores
  const allScoreEntries = useMemo(() => {
    const list: { studentId: string; studentName: string; subject: string; marks: number; maxMarks: number; pct: number; category: string; date: string }[] = [];

    // Tuition tests
    if (selectedTestType === 'All Tests (School + Tuition)' || selectedTestType === 'Tuition Tests Only') {
      tuitionTests.forEach((t) => {
        const marksList = tuitionTestMarks[t.id] || [];
        marksList.forEach((m) => {
          if (m.marks !== undefined && m.marks !== null) {
            const max = m.maxMarks || t.maxMarks || 100;
            const pct = m.percentage || (max > 0 ? Math.round((m.marks / max) * 100) : 0);
            list.push({
              studentId: m.studentId,
              studentName: m.studentName,
              subject: t.subject || 'General',
              marks: m.marks,
              maxMarks: max,
              pct,
              category: 'Tuition Test',
              date: t.dateTime || ''
            });
          }
        });
      });
    }

    // School exams
    if (selectedTestType === 'All Tests (School + Tuition)' || selectedTestType === 'School Exams Only') {
      schoolExams.forEach((e) => {
        const marksList = schoolExamMarks[e.id] || [];
        marksList.forEach((m) => {
          if (m.marks !== undefined && m.marks !== null) {
            const max = m.maxMarks || 100;
            const pct = m.percentage || (max > 0 ? Math.round((m.marks / max) * 100) : 0);
            list.push({
              studentId: m.studentId,
              studentName: m.studentName,
              subject: 'School Exams',
              marks: m.marks,
              maxMarks: max,
              pct,
              category: 'School Exam',
              date: e.startDate || ''
            });
          }
        });
      });
    }

    return list;
  }, [selectedTestType, tuitionTests, tuitionTestMarks, schoolExams, schoolExamMarks]);

  // Filter by subject
  const filteredScores = useMemo(() => {
    if (selectedSubject === 'All Subjects') return allScoreEntries;
    return allScoreEntries.filter((s) => s.subject === selectedSubject);
  }, [allScoreEntries, selectedSubject]);

  // Metrics
  const totalStudentsCount = filteredStudents.length;
  const avgScore = filteredScores.length > 0
    ? Math.round(filteredScores.reduce((sum, s) => sum + s.pct, 0) / filteredScores.length)
    : 0;

  const passCount = filteredScores.filter((s) => s.pct >= 40).length;
  const passRate = filteredScores.length > 0
    ? Math.round((passCount / filteredScores.length) * 100)
    : 0;

  // Top Performer
  const topPerformer = useMemo(() => {
    if (filteredScores.length === 0) return { name: '—', pct: 0 };
    const perStudent: Record<string, { name: string; totalPct: number; count: number }> = {};
    filteredScores.forEach((s) => {
      if (!perStudent[s.studentId]) {
        perStudent[s.studentId] = { name: s.studentName, totalPct: 0, count: 0 };
      }
      perStudent[s.studentId].totalPct += s.pct;
      perStudent[s.studentId].count += 1;
    });
    let best = { name: '—', pct: 0 };
    Object.values(perStudent).forEach((entry) => {
      const avg = Math.round(entry.totalPct / entry.count);
      if (avg > best.pct) {
        best = { name: entry.name, pct: avg };
      }
    });
    return best;
  }, [filteredScores]);

  // Subject Performance
  const subjectScores = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    allScoreEntries.forEach((s) => {
      if (!map[s.subject]) map[s.subject] = { sum: 0, count: 0 };
      map[s.subject].sum += s.pct;
      map[s.subject].count += 1;
    });
    return Object.entries(map).map(([subj, val]) => ({
      label: subj,
      value: Math.round(val.sum / val.count),
      color: '#6366F1'
    }));
  }, [allScoreEntries]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const total = filteredScores.length;
    if (total === 0) {
      return { p90: 0, p80: 0, p70: 0, p60: 0, below60: 0 };
    }
    const c90 = filteredScores.filter((s) => s.pct >= 90).length;
    const c80 = filteredScores.filter((s) => s.pct >= 80 && s.pct < 90).length;
    const c70 = filteredScores.filter((s) => s.pct >= 70 && s.pct < 80).length;
    const c60 = filteredScores.filter((s) => s.pct >= 60 && s.pct < 70).length;
    const cBelow = filteredScores.filter((s) => s.pct < 60).length;
    return {
      p90: Math.round((c90 / total) * 100),
      p80: Math.round((c80 / total) * 100),
      p70: Math.round((c70 / total) * 100),
      p60: Math.round((c60 / total) * 100),
      below60: Math.round((cBelow / total) * 100)
    };
  }, [filteredScores]);

  // Class-wise performance table
  const classPerformance = useMemo(() => {
    const classes = classesList.length > 0
      ? classesList.map((c) => c.name)
      : Array.from(new Set(students.map((s) => s.class))).filter(Boolean);

    return classes.map((cls) => {
      const classStudents = students.filter((s) => s.class === cls || s.class.includes(cls));
      const studentIds = new Set(classStudents.map((s) => s.id));
      const classMarks = allScoreEntries.filter((s) => studentIds.has(s.studentId));

      const classAvg = classMarks.length > 0
        ? Math.round(classMarks.reduce((sum, m) => sum + m.pct, 0) / classMarks.length)
        : 0;

      const classPass = classMarks.length > 0
        ? Math.round((classMarks.filter((m) => m.pct >= 40).length / classMarks.length) * 100)
        : 0;

      return {
        className: cls,
        studentsCount: classStudents.length,
        averageScore: classAvg,
        passRate: classPass,
        recordsCount: classMarks.length
      };
    });
  }, [classesList, students, allScoreEntries]);

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Class', Value: selectedClass },
      { Metric: 'Subject', Value: selectedSubject },
      { Metric: 'TestType', Value: selectedTestType },
      { Metric: 'Total Students', Value: totalStudentsCount },
      { Metric: 'Overall Pass Rate', Value: `${passRate}%` },
      { Metric: 'Average Score', Value: `${avgScore}%` },
      { Metric: 'Top Performer', Value: `${topPerformer.name} (${topPerformer.pct}%)` },
    ];
    downloadCSV(`Academic_Analytics_${selectedClass.replace(/\s+/g, '_')}.csv`, data);
    showToast('Exported academic analytics summary to CSV', 'success');
  };

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    allScoreEntries.forEach((s) => {
      if (s.subject) set.add(s.subject);
    });
    return ['All Subjects', ...Array.from(set)];
  }, [allScoreEntries]);

  const availableClassNames = useMemo(() => {
    const set = new Set<string>();
    classesList.forEach((c) => set.add(c.name));
    students.forEach((s) => { if (s.class) set.add(s.class); });
    return ['All Classes', ...Array.from(set)];
  }, [classesList, students]);

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
              {availableClassNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Subject</label>
            <select className="select-field" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
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
            <div className="stat-value">{totalStudentsCount}</div>
            <div className="stat-footer"><span className="stat-subtext">Enrolled in cohort</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Overall Pass Rate</div>
            <div className="stat-value">{passRate}%</div>
            <div className="stat-footer"><span className="stat-subtext">{passCount} passed exams</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><BarChart3 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Average Score</div>
            <div className="stat-value">{avgScore}%</div>
            <div className="stat-footer"><span className="stat-subtext">Across {filteredScores.length} marks</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink"><Award size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Top Performer</div>
            <div className="stat-value" style={{ fontSize: '15px' }}>{topPerformer.name}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{topPerformer.pct > 0 ? `${topPerformer.pct}% average` : 'No scores entered'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Assessment Entries</div>
            <div className="stat-value">{filteredScores.length}</div>
            <div className="stat-footer"><span className="stat-subtext">Logged test papers</span></div>
          </div>
        </div>
      </div>

      {/* Row 1: Comparative Trend + Subject-wise + Key Insights */}
      <div className="grid-hero-3" style={{ marginBottom: '24px' }}>
        {/* Subject-wise Bar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Subject Performance</div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Average Marks</span>
          </div>
          <div className="card-body">
            {subjectScores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94A3B8' }}>
                <AlertCircle size={28} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <div style={{ fontSize: '13px' }}>No subject examination scores recorded yet.</div>
              </div>
            ) : (
              <BarChart data={subjectScores} height={190} />
            )}
          </div>
        </div>

        {/* Score Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Score Distribution</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <DonutChart value={avgScore} size={120} label={`${avgScore}%`} sublabel="Cohort Avg" color="#6366F1" />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>90 - 100</span><strong>{scoreDistribution.p90}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>80 - 89</span><strong>{scoreDistribution.p80}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>70 - 79</span><strong>{scoreDistribution.p70}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>60 - 69</span><strong>{scoreDistribution.p60}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Below 60</span><strong style={{ color: '#EF4444' }}>{scoreDistribution.below60}%</strong></div>
            </div>
          </div>
        </div>

        {/* Key Insights Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={16} color="#F59E0B" />
              <span>Academic Summary</span>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
            <div style={{ padding: '8px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
              <strong style={{ color: '#065F46' }}>Pass Rate: {passRate}%</strong>
              <p style={{ color: '#047857', fontSize: '11.5px', marginTop: '2px' }}>
                {passCount} out of {filteredScores.length || 0} examination submissions reached 40%+ threshold.
              </p>
            </div>
            <div style={{ padding: '8px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              <strong style={{ color: '#1E40AF' }}>Enrolled Roster: {totalStudentsCount}</strong>
              <p style={{ color: '#1D4ED8', fontSize: '11.5px', marginTop: '2px' }}>
                Active students registered across selected academic cohorts.
              </p>
            </div>
            <div style={{ padding: '8px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <strong style={{ color: '#92400E' }}>Evaluated Subjects: {subjectScores.length}</strong>
              <p style={{ color: '#B45309', fontSize: '11.5px', marginTop: '2px' }}>
                Distinct academic disciplines evaluated this session.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Class-wise Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <div className="card-title">Class-wise Performance</div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Students Enrolled</th>
                <th>Test Submissions</th>
                <th>Average Score</th>
                <th>Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {classPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                    No class cohorts found in the directory.
                  </td>
                </tr>
              ) : (
                classPerformance.map((c) => (
                  <tr key={c.className}>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{c.className}</td>
                    <td>{c.studentsCount}</td>
                    <td>{c.recordsCount}</td>
                    <td><strong>{c.recordsCount > 0 ? `${c.averageScore}%` : '—'}</strong></td>
                    <td>
                      {c.recordsCount > 0 ? (
                        <span className={`badge ${c.passRate >= 75 ? 'badge-success' : 'badge-warning'}`}>
                          {c.passRate}%
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>—</span>
                      )}
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

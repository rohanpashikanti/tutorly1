import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Download,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  getStoredTuitionTests,
  getStoredTuitionTestMarks,
  getStoredSchoolExams,
  getStoredSchoolExamMarks
} from '../../utils/storage';
import { downloadSampleDocument } from '../../utils/demoActions';

interface AcademicResult {
  id: string;
  date: string;
  name: string;
  category: 'Tuition Test' | 'School Examination';
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

export const ParentAcademicProgress: React.FC = () => {
  const { selectedChildId, setSelectedChildId, activeInstitutionId, showToast } = useApp();
  const [children, setChildren] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Tuition Test' | 'School Examination'>('All');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.portals.getParent(activeInstitutionId)
      .then((res) => {
        if (res && res.children) {
          setChildren(res.children);
          if (res.children.length > 0 && !selectedChildId) {
            setSelectedChildId(res.children[0].id);
          }
        } else {
          setChildren([]);
        }
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load children');
        setChildren([]);
      });
  }, [activeInstitutionId, selectedChildId, setSelectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  // Real chronological results for active child
  const allChildResults: AcademicResult[] = useMemo(() => {
    if (!activeChild) return [];
    const results: AcademicResult[] = [];

    // Tuition tests
    const tests = getStoredTuitionTests();
    const testMarksMap = getStoredTuitionTestMarks();
    tests.forEach((t) => {
      const marksList = testMarksMap[t.id] || [];
      const m = marksList.find((entry) => entry.studentId === activeChild.id || entry.studentName === activeChild.name);
      if (m && m.marks !== undefined && m.marks !== null) {
        results.push({
          id: `tt-${t.id}`,
          date: t.dateTime || '—',
          name: t.name,
          category: 'Tuition Test',
          subject: t.subject || 'General',
          marksObtained: m.marks,
          maxMarks: m.maxMarks || t.maxMarks || 100,
          percentage: m.percentage ?? (m.maxMarks ? Math.round((m.marks / m.maxMarks) * 100) : 0)
        });
      }
    });

    // School exams
    const exams = getStoredSchoolExams();
    const examMarksMap = getStoredSchoolExamMarks();
    exams.forEach((ex) => {
      const marksList = examMarksMap[ex.id] || [];
      const m = marksList.find((entry) => entry.studentId === activeChild.id || entry.studentName === activeChild.name);
      if (m && m.marks !== undefined && m.marks !== null) {
        results.push({
          id: `exam-${ex.id}`,
          date: ex.startDate || '—',
          name: ex.name,
          category: 'School Examination',
          subject: 'All Subjects',
          marksObtained: m.marks,
          maxMarks: m.maxMarks || 100,
          percentage: m.percentage ?? (m.maxMarks ? Math.round((m.marks / m.maxMarks) * 100) : 0)
        });
      }
    });

    return results;
  }, [activeChild]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    allChildResults.forEach((r) => set.add(r.subject));
    return ['All', ...Array.from(set)];
  }, [allChildResults]);

  const filteredResults = allChildResults.filter((item) => {
    const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSub = subjectFilter === 'All' || item.subject === subjectFilter;
    return matchesCat && matchesSub;
  });

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Parent Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Academic Progress</span>
          </div>
          <h1>Academic Progress</h1>
          <p className="page-subtitle">
            Review your child's actual tuition test and school examination results in chronological order.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            disabled={!activeChild || filteredResults.length === 0}
            onClick={() => {
              if (!activeChild) return;
              downloadSampleDocument(
                `${activeChild.name}_Academic_Report.pdf`,
                `TUTORLY ACADEMIC RESULTS REPORT\n\nStudent: ${activeChild.name}\nClass: ${activeChild.class || 'N/A'}\nRoll No: ${activeChild.rollNo || 'N/A'}\nDate Generated: ${new Date().toLocaleDateString()}\n\nRecent Results:\n` +
                  filteredResults
                    .map((r) => `- ${r.date}: ${r.name} (${r.subject}) - ${r.marksObtained}/${r.maxMarks} (${r.percentage}%) [${r.category}]`)
                    .join('\n')
              );
              showToast(`Downloaded academic report for ${activeChild.name}`, 'success');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#991B1B', fontSize: '13px' }}>
          Unable to refresh portal children from server: {loadError}
        </div>
      )}

      {/* Child Switcher & Filter Toolbar */}
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

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Category Toggle Tabs */}
          <div className="tabs-container" style={{ margin: 0 }}>
            {(['All', 'Tuition Test', 'School Examination'] as const).map((cat) => (
              <button
                key={cat}
                className={`tab-btn ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
                style={{ fontSize: '12.5px', padding: '6px 12px' }}
              >
                {cat === 'All' ? 'All Types' : cat === 'Tuition Test' ? 'Tuition Tests' : 'School Exams'}
              </button>
            ))}
          </div>

          {/* Subject Filter */}
          <select
            className="select-field"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '12.5px', minWidth: '130px' }}
            aria-label="Filter by subject"
          >
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub === 'All' ? 'All Subjects' : sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Container Card */}
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
              Test & Exam Results ({filteredResults.length})
            </h3>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Showing chronological academic results for {activeChild ? `${activeChild.name} (${activeChild.class})` : 'Student'}
            </div>
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No results found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {!activeChild
                  ? 'No child is linked to this parent account.'
                  : 'No academic records match the selected type or subject filter.'}
              </div>
              {(categoryFilter !== 'All' || subjectFilter !== 'All') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setCategoryFilter('All');
                    setSubjectFilter('All');
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
                    <th style={{ width: '120px' }}>Date</th>
                    <th>Test / Examination Name</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Marks Obtained</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((res) => (
                    <tr key={res.id} style={{ height: '52px' }}>
                      <td style={{ fontSize: '12.5px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {res.date}
                      </td>
                      <td style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                        {res.name}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: res.category === 'Tuition Test' ? '#EEF2FF' : '#DCFCE7',
                            color: res.category === 'Tuition Test' ? '#4F46E5' : '#16A34A',
                            fontWeight: 600,
                            fontSize: '11px'
                          }}
                        >
                          {res.category}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                        {res.subject}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                        {res.marksObtained} / {res.maxMarks}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: res.percentage >= 85 ? '#DCFCE7' : res.percentage >= 70 ? '#FEF3C7' : '#FEE2E2',
                            color: res.percentage >= 85 ? '#166534' : res.percentage >= 70 ? '#92400E' : '#991B1B',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '3px 8px'
                          }}
                        >
                          {res.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Result Cards */}
            <div className="student-mobile-cards">
              {filteredResults.map((res) => (
                <div key={res.id} className="student-mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                        {res.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {res.subject} • {res.date}
                      </div>
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: res.percentage >= 85 ? '#DCFCE7' : res.percentage >= 70 ? '#FEF3C7' : '#FEE2E2',
                        color: res.percentage >= 85 ? '#166534' : res.percentage >= 70 ? '#92400E' : '#991B1B',
                        fontWeight: 700,
                        fontSize: '12px',
                        padding: '3px 8px'
                      }}
                    >
                      {res.percentage}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      borderTop: '1px solid #F1F5F9',
                      fontSize: '12px'
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        backgroundColor: res.category === 'Tuition Test' ? '#EEF2FF' : '#DCFCE7',
                        color: res.category === 'Tuition Test' ? '#4F46E5' : '#16A34A',
                        fontSize: '10.5px'
                      }}
                    >
                      {res.category}
                    </span>
                    <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                      Marks: {res.marksObtained} / {res.maxMarks}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

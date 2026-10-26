import React, { useState } from 'react';
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
  const { selectedChildId, setSelectedChildId, selectedChild, showToast } = useApp();
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Tuition Test' | 'School Examination'>('All');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  const isAditya = selectedChildId === 'stu-001';

  // Real chronological results for selected child
  const adityaResults: AcademicResult[] = [
    { id: 'ar-1', date: '25 Oct 2026', name: 'Unit Test 3', category: 'Tuition Test', subject: 'Mathematics', marksObtained: 46, maxMarks: 50, percentage: 92 },
    { id: 'ar-2', date: '22 Oct 2026', name: 'Monthly Test', category: 'Tuition Test', subject: 'Science', marksObtained: 42, maxMarks: 50, percentage: 84 },
    { id: 'ar-3', date: '18 Oct 2026', name: 'Unit Test 2', category: 'Tuition Test', subject: 'English', marksObtained: 38, maxMarks: 50, percentage: 76 },
    { id: 'ar-4', date: '10 Oct 2026', name: 'Half-Yearly Examination', category: 'School Examination', subject: 'Science', marksObtained: 84, maxMarks: 100, percentage: 84 },
    { id: 'ar-5', date: '08 Oct 2026', name: 'Half-Yearly Examination', category: 'School Examination', subject: 'Mathematics', marksObtained: 92, maxMarks: 100, percentage: 92 },
    { id: 'ar-6', date: '06 Oct 2026', name: 'Half-Yearly Examination', category: 'School Examination', subject: 'Social Studies', marksObtained: 88, maxMarks: 100, percentage: 88 },
    { id: 'ar-7', date: '04 Oct 2026', name: 'Half-Yearly Examination', category: 'School Examination', subject: 'English', marksObtained: 78, maxMarks: 100, percentage: 78 },
    { id: 'ar-8', date: '28 Sep 2026', name: 'Chapter Test', category: 'Tuition Test', subject: 'Social Studies', marksObtained: 44, maxMarks: 50, percentage: 88 }
  ];

  const kavyaResults: AcademicResult[] = [
    { id: 'kr-1', date: '24 Oct 2026', name: 'Monthly Evaluation', category: 'Tuition Test', subject: 'Science', marksObtained: 43, maxMarks: 50, percentage: 86 },
    { id: 'kr-2', date: '20 Oct 2026', name: 'Unit Test 2', category: 'Tuition Test', subject: 'Mathematics', marksObtained: 39, maxMarks: 50, percentage: 78 },
    { id: 'kr-3', date: '16 Oct 2026', name: 'Vocabulary & Grammar Test', category: 'Tuition Test', subject: 'English', marksObtained: 41, maxMarks: 50, percentage: 82 },
    { id: 'kr-4', date: '09 Oct 2026', name: 'Term 1 Exam', category: 'School Examination', subject: 'Science', marksObtained: 85, maxMarks: 100, percentage: 85 },
    { id: 'kr-5', date: '07 Oct 2026', name: 'Term 1 Exam', category: 'School Examination', subject: 'Mathematics', marksObtained: 79, maxMarks: 100, percentage: 79 },
    { id: 'kr-6', date: '05 Oct 2026', name: 'Term 1 Exam', category: 'School Examination', subject: 'English', marksObtained: 81, maxMarks: 100, percentage: 81 },
    { id: 'kr-7', date: '26 Sep 2026', name: 'Monthly Test', category: 'Tuition Test', subject: 'Social Studies', marksObtained: 40, maxMarks: 50, percentage: 80 }
  ];

  const allChildResults = isAditya ? adityaResults : kavyaResults;

  const filteredResults = allChildResults.filter((item) => {
    const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesSub = subjectFilter === 'All' || item.subject === subjectFilter;
    return matchesCat && matchesSub;
  });

  const subjects = ['All', 'Mathematics', 'Science', 'English', 'Social Studies'];

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
            onClick={() => {
              downloadSampleDocument(
                `${selectedChild.name}_Academic_Report.pdf`,
                `TUTORLY ACADEMIC RESULTS REPORT\n\nStudent: ${selectedChild.name}\nClass: ${selectedChild.class}\nRoll No: ${selectedChild.rollNo}\nDate Generated: 25 Oct 2026\n\nRecent Results:\n` +
                  filteredResults
                    .map((r) => `- ${r.date}: ${r.name} (${r.subject}) - ${r.marksObtained}/${r.maxMarks} (${r.percentage}%) [${r.category}]`)
                    .join('\n')
              );
              showToast(`Downloaded academic report for ${selectedChild.name}`, 'success');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Download Report</span>
          </button>
        </div>
      </div>

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
              Showing chronological academic results for {isAditya ? 'Aditya Sharma (Class 10)' : 'Kavya Sharma (Class 9)'}
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
                No academic records match the selected type or subject filter.
              </div>
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

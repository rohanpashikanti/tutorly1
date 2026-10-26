import React, { useState } from 'react';
import {
  Users,
  Search,
  X,
  Eye,
  ClipboardCheck,
  Download,
  AlertCircle,
  BookOpen,
  ArrowRight,
  Phone,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredStudents } from '../../utils/storage';
import { downloadCSV } from '../../utils/demoActions';
import { ParentContactActions } from '../../components/common/ParentContactActions';

interface ClassCohort {
  id: string;
  name: string;
  grade: string;
  section: string;
  batchTime: string;
  subject: string;
  studentsCount: number;
}

export const TeacherClassesPage: React.FC = () => {
  const { navigateTo, showToast, selectedBatchId, setSelectedBatchId } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Needs Attention'>('All');

  const allStudents = getStoredStudents();

  const assignedBatches: ClassCohort[] = [
    {
      id: 'c10-a',
      name: 'Class 10 - Section A',
      grade: 'Grade 10',
      section: 'Section A',
      batchTime: 'Morning (08:30 AM - 10:30 AM)',
      subject: 'Mathematics',
      studentsCount: allStudents.filter(s => s.class.includes('10')).length
    },
    {
      id: 'c9-b',
      name: 'Class 9 - Section B',
      grade: 'Grade 9',
      section: 'Section B',
      batchTime: 'Evening (04:30 PM - 06:30 PM)',
      subject: 'Science',
      studentsCount: allStudents.filter(s => s.class.includes('9')).length
    }
  ];

  const currentCohort = assignedBatches.find((b) => b.id === selectedBatchId) || assignedBatches[0];

  // Filter students by assigned cohort
  const cohortStudents = allStudents.filter(
    (s) => (selectedBatchId === 'c10-a' ? s.class.includes('10') : s.class.includes('9'))
  );

  // Search and status filtering
  const filteredStudents = cohortStudents.filter((stu) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      stu.name.toLowerCase().includes(q) ||
      stu.rollNo.toLowerCase().includes(q) ||
      (stu.admissionNo && stu.admissionNo.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Active' && stu.status === 'Active') ||
      (statusFilter === 'Needs Attention' && stu.status === 'Needs Attention');

    return matchesQuery && matchesStatus;
  });

  const handleExportRoster = () => {
    const data = filteredStudents.map((s) => ({
      'Roll No': s.rollNo,
      'Student Name': s.name,
      Class: s.class,
      Batch: currentCohort.name,
      'Admission No': s.admissionNo || '',
      Parent: s.parent?.fatherName || s.parentName || 'Parent',
      Phone: s.parent?.phone || s.parentPhone || '+91 98765 00000',
      Status: s.status
    }));
    downloadCSV(`${currentCohort.name.replace(/\s+/g, '_')}_roster.csv`, data);
    showToast(`Exported ${data.length} students from ${currentCohort.name} to CSV`, 'success');
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Teacher Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>My Classes</span>
          </div>
          <h1>My Classes & Batches</h1>
          <p className="page-subtitle">
            Manage your assigned cohorts, search students by name or roll number, and view records.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportRoster}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export Roster</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigateTo('attendance-register')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ClipboardCheck size={16} />
            <span>Mark Attendance</span>
          </button>
        </div>
      </div>

      {/* Class and Batch Overview Cards */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select Class or Batch
        </div>
        <div className="class-switcher-grid">
          {assignedBatches.map((batch) => {
            const isSelected = selectedBatchId === batch.id;
            return (
              <div
                key={batch.id}
                className={`class-switcher-card ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedBatchId(batch.id);
                  setSearchQuery('');
                }}
                role="button"
                tabIndex={0}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="badge badge-purple" style={{ fontSize: '11px', fontWeight: 700 }}>
                      {batch.grade}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {batch.subject}
                    </span>
                  </div>
                  <h3
                    className="class-title"
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 700,
                      color: isSelected ? '#4F46E5' : '#0F172A'
                    }}
                  >
                    {batch.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    {batch.batchTime}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span className="badge badge-gray" style={{ fontWeight: 700, fontSize: '12px' }}>
                    {batch.studentsCount} Students
                  </span>
                  {isSelected ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#4F46E5' }}>
                      <Check size={14} /> Active
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Open <ArrowRight size={12} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Student List Container */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        {/* Controls Toolbar: Title + Search + Filters */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#FFFFFF'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              {currentCohort.name} — Student List ({filteredStudents.length})
            </h3>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Showing enrolled students for {currentCohort.grade} • {currentCohort.subject}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            {/* Functional Search Field */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '7px 12px',
                width: 'min(320px, 100%)'
              }}
            >
              <Search size={15} color="#64748B" />
              <input
                type="text"
                placeholder="Search students by name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '13px',
                  width: '100%',
                  color: '#0F172A'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '7px 12px', fontSize: '12.5px', minWidth: '130px' }}
              aria-label="Filter by student status"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Needs Attention">Needs Attention</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredStudents.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No students found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {searchQuery
                  ? `No students match "${searchQuery}" in ${currentCohort.name}.`
                  : 'No students found matching the selected filter.'}
              </div>
              {(searchQuery || statusFilter !== 'All') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                  }}
                  style={{ marginTop: '8px' }}
                >
                  Reset Search & Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Clean Table */}
            <div className="table-responsive student-desktop-table">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Roll No</th>
                    <th>Student Name</th>
                    <th>Class & Batch</th>
                    <th>Parent Contact</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Status</th>
                    <th style={{ textAlign: 'right', width: '120px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((stu) => (
                    <tr key={stu.id} style={{ height: '52px' }}>
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#4F46E5',
                            fontSize: '12.5px',
                            backgroundColor: '#EEF2FF',
                            padding: '3px 8px',
                            borderRadius: '5px'
                          }}
                        >
                          {stu.rollNo}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={stu.avatar}
                            alt={stu.name}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                              {stu.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              Adm: {stu.admissionNo} • {stu.gender}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                          {stu.class}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                          {currentCohort.name}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                          {stu.parent?.fatherName || stu.parentName || 'Parent'}
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          <ParentContactActions
                            phone={stu.parent?.phone || stu.parentPhone || '+91 98765 00000'}
                            parentName={stu.parent?.fatherName || stu.parentName || 'Parent'}
                            studentName={stu.name}
                            size="sm"
                            showNumber={true}
                          />
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${
                            stu.status === 'Active'
                              ? 'badge-success'
                              : stu.status === 'Needs Attention'
                              ? 'badge-warning'
                              : 'badge-gray'
                          }`}
                        >
                          {stu.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => navigateTo('teacher-student-detail', { studentId: stu.id, batchId: selectedBatchId })}
                          title={`View ${stu.name}'s Profile`}
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Student Cards */}
            <div className="student-mobile-cards">
              {filteredStudents.map((stu) => (
                <div key={stu.id} className="student-mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={stu.avatar}
                        alt={stu.name}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                          {stu.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#4F46E5',
                              fontSize: '11px',
                              backgroundColor: '#EEF2FF',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            Roll: {stu.rollNo}
                          </span>
                          <span
                            className={`badge ${
                              stu.status === 'Active' ? 'badge-success' : 'badge-warning'
                            }`}
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                          >
                            {stu.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={() => navigateTo('teacher-student-detail', { studentId: stu.id, batchId: selectedBatchId })}
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      paddingTop: '8px',
                      borderTop: '1px solid #F1F5F9'
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      <span style={{ color: '#0F172A', fontWeight: 600 }}>Parent:</span>{' '}
                      {stu.parent?.fatherName || stu.parentName || 'Parent'}
                    </div>
                    <div>
                      <ParentContactActions
                        phone={stu.parent?.phone || stu.parentPhone || '+91 98765 00000'}
                        parentName={stu.parent?.fatherName || stu.parentName || 'Parent'}
                        studentName={stu.name}
                        size="sm"
                        showNumber={true}
                      />
                    </div>
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

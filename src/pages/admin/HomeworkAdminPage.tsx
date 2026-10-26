import React, { useState, useMemo } from 'react';
import {
  BookMarked,
  Plus,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  Eye,
  FileText,
  AlertCircle,
  X,
  Download,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getStoredHomework,
  saveStoredHomework,
  getStoredStudents,
  getStoredClasses,
  getStoredSubjects
} from '../../utils/storage';
import { HomeworkItem } from '../../types';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

export const HomeworkAdminPage: React.FC = () => {
  const { showToast, currentUser } = useApp();
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(getStoredHomework);
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeReviewHw, setActiveReviewHw] = useState<HomeworkItem | null>(null);

  const [newHw, setNewHw] = useState({
    title: '',
    class: 'Class 10 - A',
    subject: 'Mathematics',
    assignedDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
  });

  const [submissions, setSubmissions] = useState<any[]>([]);

  const handleOpenReview = (hw: HomeworkItem) => {
    setActiveReviewHw(hw);
    const students = getStoredStudents();
    const enrolled = students.filter(
      (s) => !hw.class || hw.class === 'All Classes' || s.class === hw.class || hw.class.includes(s.class)
    );
    setSubmissions(
      enrolled.map((s) => ({
        id: s.id,
        name: s.name,
        rollNo: s.rollNo,
        avatar: s.avatar,
        submittedAt: '—',
        status: 'Pending',
        score: '—',
      }))
    );
  };

  const handleExportCSV = () => {
    const data = filteredHomework.map((hw) => ({
      Title: hw.title,
      Class: hw.class,
      Subject: hw.subject,
      AssignedDate: hw.assignedDate,
      DueDate: hw.dueDate,
      AssignedBy: hw.assignedBy || hw.teacherName || 'Tutor',
      Submitted: `${hw.submittedCount || 0}/${hw.totalCount || 0}`,
      SubmissionRate: `${hw.totalCount ? Math.round(((hw.submittedCount || 0) / hw.totalCount) * 100) : 0}%`,
    }));
    downloadCSV('Homework_Assignments_Tracking.csv', data);
    showToast(`Exported ${data.length} homework records to CSV`, 'success');
  };

  const handleCreateHomework = (e: React.FormEvent) => {
    e.preventDefault();
    const students = getStoredStudents();
    const enrolledCount = students.filter(
      (s) => !newHw.class || newHw.class === 'All Classes' || s.class === newHw.class || newHw.class.includes(s.class)
    ).length;

    const item: HomeworkItem = {
      id: `hw-${Date.now()}`,
      title: newHw.title,
      class: newHw.class,
      subject: newHw.subject,
      assignedDate: newHw.assignedDate,
      dueDate: newHw.dueDate || 'Upcoming',
      description: newHw.description,
      assignedBy: currentUser?.name || 'Administrator',
      submittedCount: 0,
      totalCount: enrolledCount,
      status: 'Pending',
    };

    const updated = [item, ...homeworkList];
    setHomeworkList(updated);
    saveStoredHomework(updated);
    setShowAssignModal(false);
    setNewHw({
      title: '',
      class: 'Class 10 - A',
      subject: 'Mathematics',
      assignedDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      description: '',
    });
    showToast(`Assigned homework "${item.title}" to ${item.class}!`, 'success');
  };

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    homeworkList.forEach((hw) => {
      if (hw.class) set.add(hw.class);
    });
    return ['All Classes', ...Array.from(set)];
  }, [homeworkList]);

  const filteredHomework = homeworkList.filter((hw) => {
    const matchesClass = selectedClass === 'All Classes' || hw.class.includes(selectedClass);
    const matchesSearch =
      hw.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hw.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (hw.assignedBy || hw.teacherName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Academic Management</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Homework Tracking</span>
          </div>
          <h1>Homework & Assignments</h1>
          <p className="page-subtitle">
            Manage curriculum homework assignments, monitor turn-in compliance, and verify submissions.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            disabled={filteredHomework.length === 0}
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAssignModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div className="tabs-container" style={{ margin: 0 }}>
            {availableClasses.map((cls) => (
              <button
                key={cls}
                className={`tab-btn ${selectedClass === cls ? 'active' : ''}`}
                onClick={() => setSelectedClass(cls)}
              >
                {cls}
              </button>
            ))}
          </div>

          <div className="search-box" style={{ width: '280px' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search by assignment, subject, tutor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Homework Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Assignment Title</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Assigned Date</th>
                <th>Due Date</th>
                <th>Assigned Tutor</th>
                <th>Submissions</th>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHomework.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={32} color="#94A3B8" />
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                        No homework assignments found
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748B' }}>
                        {searchQuery || selectedClass !== 'All Classes'
                          ? 'No homework assignments match the current filters.'
                          : 'No coursework assignments have been created yet.'}
                      </div>
                      {!searchQuery && selectedClass === 'All Classes' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowAssignModal(true)}
                          style={{ marginTop: '8px' }}
                        >
                          <Plus size={14} />
                          <span>Assign First Homework</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHomework.map((hw) => {
                  const total = hw.totalCount || 0;
                  const submitted = hw.submittedCount || 0;
                  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                  return (
                    <tr key={hw.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{hw.title}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hw.description || '—'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray">{hw.class}</span>
                      </td>
                      <td>
                        <span className="badge badge-purple">{hw.subject}</span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748B' }}>{hw.assignedDate}</td>
                      <td style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444' }}>{hw.dueDate}</td>
                      <td style={{ fontSize: '13px', color: '#334155' }}>{hw.assignedBy || hw.teacherName || 'Tutor'}</td>
                      <td style={{ fontWeight: 600 }}>
                        {submitted} / {total}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 80 ? '#10B981' : '#F59E0B' }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: pct >= 80 ? '#10B981' : '#F59E0B' }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleOpenReview(hw)}
                        >
                          <Eye size={13} />
                          <span style={{ marginLeft: '4px' }}>Submissions</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Homework Modal */}
      {showAssignModal && (
        <div className="modal-backdrop" onClick={() => setShowAssignModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign New Homework</h2>
              <button onClick={() => setShowAssignModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleCreateHomework}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assignment Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chapter 4 Trigonometry Exercise 4.2"
                    value={newHw.title}
                    onChange={(e) => setNewHw({ ...newHw, title: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Target Class</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Class 10 - A"
                      value={newHw.class}
                      onChange={(e) => setNewHw({ ...newHw, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics"
                      value={newHw.subject}
                      onChange={(e) => setNewHw({ ...newHw, subject: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assigned Date</label>
                    <input
                      type="date"
                      value={newHw.assignedDate}
                      onChange={(e) => setNewHw({ ...newHw, assignedDate: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Due Date</label>
                    <input
                      type="date"
                      value={newHw.dueDate}
                      onChange={(e) => setNewHw({ ...newHw, dueDate: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Instructions & Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide questions to solve, textbook page numbers, and formatting rules..."
                    value={newHw.description}
                    onChange={(e) => setNewHw({ ...newHw, description: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Publish Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions Review Modal */}
      {activeReviewHw && (
        <div className="modal-backdrop" onClick={() => setActiveReviewHw(null)}>
          <div className="modal-card" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Submissions: {activeReviewHw.title}</h2>
                <div style={{ fontSize: '12px', color: '#64748B' }}>{activeReviewHw.class} • Due: {activeReviewHw.dueDate}</div>
              </div>
              <button onClick={() => setActiveReviewHw(null)}><X size={20} color="#64748B" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Student Turn-Ins ({submissions.length})</span>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={submissions.length === 0}
                  onClick={() => {
                    const data = submissions.map((s) => ({
                      RollNo: s.rollNo,
                      StudentName: s.name,
                      Assignment: activeReviewHw.title,
                      SubmittedAt: s.submittedAt,
                      Status: s.status,
                      Score: s.score,
                    }));
                    downloadCSV(`Submissions_${activeReviewHw.title.replace(/\s+/g, '_')}.csv`, data);
                    showToast('Exported submissions list to CSV', 'success');
                  }}
                >
                  <Download size={13} />
                  <span>Export Submissions</span>
                </button>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll No</th>
                      <th>Submitted At</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                          No students enrolled in this class cohort yet.
                        </td>
                      </tr>
                    ) : (
                      submissions.map((sub) => (
                        <tr key={sub.id}>
                          <td>
                            <div className="user-table-cell">
                              <span className="user-table-name">{sub.name}</span>
                            </div>
                          </td>
                          <td>{sub.rollNo || '—'}</td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>{sub.submittedAt}</td>
                          <td>
                            <span className="badge badge-info">
                              {sub.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{sub.score}</td>
                          <td>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>No upload</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveReviewHw(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

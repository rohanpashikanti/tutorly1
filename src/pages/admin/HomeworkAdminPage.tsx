import React, { useState } from 'react';
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
import { MOCK_HOMEWORK, MOCK_STUDENTS } from '../../data/mockData';
import { HomeworkItem } from '../../types';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

export const HomeworkAdminPage: React.FC = () => {
  const { showToast } = useApp();
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(MOCK_HOMEWORK);
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeReviewHw, setActiveReviewHw] = useState<HomeworkItem | null>(null);

  const [newHw, setNewHw] = useState({
    title: '',
    class: 'Class 10 - A',
    subject: 'Mathematics',
    assignedDate: '2026-10-25',
    dueDate: '2026-10-28',
    description: '',
  });

  const [submissions, setSubmissions] = useState([
    { id: '1', name: 'Aditya Sharma', rollNo: '001', avatar: MOCK_STUDENTS[0].avatar, submittedAt: '2026-10-26 14:30', status: 'Graded', score: '10/10' },
    { id: '2', name: 'Bhavana Reddy', rollNo: '002', avatar: MOCK_STUDENTS[2].avatar, submittedAt: '2026-10-26 16:15', status: 'Graded', score: '9/10' },
    { id: '3', name: 'Charan Kumar', rollNo: '003', avatar: MOCK_STUDENTS[3].avatar, submittedAt: '2026-10-27 10:00', status: 'Submitted', score: 'Pending' },
    { id: '4', name: 'Divya Nair', rollNo: '004', avatar: MOCK_STUDENTS[4].avatar, submittedAt: '2026-10-27 11:20', status: 'Submitted', score: 'Pending' },
    { id: '5', name: 'Harshith Reddy', rollNo: '005', avatar: MOCK_STUDENTS[5].avatar, submittedAt: '—', status: 'Missing', score: '—' },
  ]);

  const handleExportCSV = () => {
    const data = filteredHomework.map((hw) => ({
      Title: hw.title,
      Class: hw.class,
      Subject: hw.subject,
      AssignedDate: hw.assignedDate,
      DueDate: hw.dueDate,
      AssignedBy: hw.assignedBy || hw.teacherName || 'Tutor',
      Submitted: `${hw.submittedCount || 0}/${hw.totalCount || 30}`,
      SubmissionRate: `${Math.round(((hw.submittedCount || 0) / (hw.totalCount || 30)) * 100)}%`,
    }));
    downloadCSV('Homework_Assignments_Tracking.csv', data);
    showToast(`Exported ${data.length} homework records to CSV`, 'success');
  };

  const handleCreateHomework = (e: React.FormEvent) => {
    e.preventDefault();
    const item: HomeworkItem = {
      id: `hw-${Date.now()}`,
      title: newHw.title,
      class: newHw.class,
      subject: newHw.subject,
      assignedDate: newHw.assignedDate,
      dueDate: newHw.dueDate,
      description: newHw.description,
      assignedBy: 'Administrator',
      submittedCount: 0,
      totalCount: 30,
      status: 'Pending',
    };
    setHomeworkList([item, ...homeworkList]);
    setShowAssignModal(false);
    setNewHw({
      title: '',
      class: 'Class 10 - A',
      subject: 'Mathematics',
      assignedDate: '2026-10-25',
      dueDate: '2026-10-28',
      description: '',
    });
    showToast(`Assigned homework "${item.title}" to ${item.class}!`, 'success');
  };

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Assessments</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Homework</span>
          </div>
          <h1>Homework Tracking & Reviews</h1>
          <p className="page-subtitle">
            Track daily assignments, syllabus coverage, and submission rates across all batches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
            <Plus size={15} />
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Active Assignments</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
              <BookMarked size={18} />
            </div>
          </div>
          <div className="stat-card-value">14</div>
          <div className="stat-card-subtext">Across all classes</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Average Submission Rate</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-card-value">86.4%</div>
          <div className="stat-card-trend trend-up">
            <span>↑ 4.2% this week</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Pending Submissions</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-card-value">38</div>
          <div className="stat-card-subtext">Awaiting student turn-in</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Pending Reviews</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <FileText size={18} />
            </div>
          </div>
          <div className="stat-card-value">12</div>
          <div className="stat-card-subtext">Requires teacher grading</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Class Filter:</label>
            <select
              className="form-control"
              style={{ width: '180px' }}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="All Classes">All Classes</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 8">Class 8</option>
            </select>
          </div>

          <div className="search-box" style={{ width: '280px' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search by topic, subject, or tutor..."
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
              {filteredHomework.map((hw) => {
                const total = hw.totalCount || 30;
                const submitted = hw.submittedCount || 0;
                const pct = Math.round((submitted / total) * 100);
                return (
                  <tr key={hw.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{hw.title}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {hw.description}
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
                      {hw.submittedCount || 0} / {hw.totalCount || 30}
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
                        onClick={() => setActiveReviewHw(hw)}
                      >
                        <Eye size={13} />
                        <span style={{ marginLeft: '4px' }}>Submissions</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
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
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Target Class & Batch</label>
                    <select
                      value={newHw.class}
                      onChange={(e) => setNewHw({ ...newHw, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Class 10 - A</option>
                      <option>Class 10 - B</option>
                      <option>Class 9 - A</option>
                      <option>Class 8 - A</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject</label>
                    <select
                      value={newHw.subject}
                      onChange={(e) => setNewHw({ ...newHw, subject: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Mathematics</option>
                      <option>Physics</option>
                      <option>Chemistry</option>
                      <option>Biology</option>
                      <option>English</option>
                    </select>
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
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <div className="user-table-cell">
                            <img src={sub.avatar} alt={sub.name} className="user-table-avatar" />
                            <span className="user-table-name">{sub.name}</span>
                          </div>
                        </td>
                        <td>{sub.rollNo}</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>{sub.submittedAt}</td>
                        <td>
                          <span className={`badge ${sub.status === 'Graded' ? 'badge-success' : sub.status === 'Submitted' ? 'badge-info' : 'badge-danger'}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{sub.score}</td>
                        <td>
                          {sub.status !== 'Missing' ? (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                downloadSampleDocument(
                                  `Submission_${sub.name.replace(/\s+/g, '_')}_${activeReviewHw.title.replace(/\s+/g, '_')}.txt`,
                                  `STUDENT HOMEWORK SUBMISSION\nAssignment: ${activeReviewHw.title}\nStudent: ${sub.name}\nRoll: ${sub.rollNo}\nDate: ${sub.submittedAt}\n\n[Answers handwritten attached in submission record]`
                                );
                                showToast(`Downloaded submission document for ${sub.name}`, 'success');
                              }}
                            >
                              <Download size={12} />
                              <span>View Work</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>No upload</span>
                          )}
                        </td>
                      </tr>
                    ))}
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

import React, { useState, useMemo } from 'react';
import {
  BookMarked,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  Eye,
  X,
  FileText,
  Send,
  MessageSquare,
  Download,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredHomework, saveStoredHomework, getStoredStudents } from '../../utils/storage';
import { HomeworkItem } from '../../types';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

interface StudentSubmission {
  id: string;
  name: string;
  rollNo: string;
  submittedAt: string;
  status: 'Reviewed' | 'Pending Review' | 'Resubmission Required';
  marks: string;
}

export const TeacherHomeworkPage: React.FC = () => {
  const { showToast, currentUser } = useApp();
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(getStoredHomework);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [reviewingHw, setReviewingHw] = useState<HomeworkItem | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');

  // Form states
  const [title, setTitle] = useState<string>('');
  const [targetClass, setTargetClass] = useState<string>('Class 10 - A');
  const [subject, setSubject] = useState<string>('Mathematics');
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Dynamic submissions for the currently reviewed homework
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);

  const handleOpenReview = (hw: HomeworkItem) => {
    setReviewingHw(hw);
    const students = getStoredStudents();
    const enrolled = students.filter(
      (s) => !hw.class || hw.class === 'All Classes' || s.class === hw.class || hw.class.includes(s.class)
    );
    setSubmissions(
      enrolled.map((s) => ({
        id: `sub-${s.id}`,
        name: s.name,
        rollNo: s.rollNo,
        submittedAt: 'Pending Submission',
        status: 'Pending Review' as const,
        marks: '—'
      }))
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      showToast('Please provide homework title', 'warning');
      return;
    }

    const students = getStoredStudents();
    const enrolledCount = students.filter(
      (s) => !targetClass || targetClass === 'All Classes' || s.class === targetClass || targetClass.includes(s.class)
    ).length;

    const newItem: HomeworkItem = {
      id: `hw-${Date.now()}`,
      title,
      class: targetClass,
      subject,
      assignedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      dueDate: dueDate || 'Upcoming',
      description,
      submittedCount: 0,
      totalCount: enrolledCount,
      assignedBy: currentUser?.name || 'Teacher'
    };

    const updated = [newItem, ...homeworkList];
    setHomeworkList(updated);
    saveStoredHomework(updated);
    setIsCreateModalOpen(false);
    setTitle('');
    setDescription('');
    showToast(`Homework assignment "${title}" published to ${targetClass}!`, 'success');
  };

  const handleExportCSV = () => {
    const data = filteredList.map((hw) => ({
      Title: hw.title,
      Class: hw.class,
      Subject: hw.subject,
      'Assigned Date': hw.assignedDate,
      'Due Date': hw.dueDate,
      Submitted: `${hw.submittedCount || 0} / ${hw.totalCount || 0}`
    }));
    downloadCSV('teacher_homework_roster.csv', data);
    showToast(`Exported ${data.length} homework records to CSV`, 'success');
  };

  const handleDownloadStudentWork = (sub: StudentSubmission) => {
    downloadSampleDocument(
      `${sub.name}_Homework_Submission.pdf`,
      `STUDENT HOMEWORK SUBMISSION\n\nStudent: ${sub.name} (${sub.rollNo})\nAssignment: ${reviewingHw?.title}\nSubject: ${reviewingHw?.subject}\nTurn-in Timestamp: ${sub.submittedAt}\nCurrent Status: ${sub.status}\nScore: ${sub.marks}\n\n[Teacher Feedback Sheet]`
    );
    showToast(`Downloaded submission document for ${sub.name}`, 'success');
  };

  const handleUpdateStatus = (id: string, newStatus: StudentSubmission['status']) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    showToast(`Status updated to ${newStatus}`, 'info');
  };

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    homeworkList.forEach((hw) => {
      if (hw.subject) set.add(hw.subject);
    });
    return ['All', ...Array.from(set)];
  }, [homeworkList]);

  const filteredList = homeworkList.filter(
    (hw) => selectedSubjectFilter === 'All' || hw.subject === selectedSubjectFilter
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Teacher Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Homework</span>
          </div>
          <h1>Homework Assignments & Reviews</h1>
          <p className="page-subtitle">
            Create new assignments, set submission deadlines, and review student practice work.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            disabled={filteredList.length === 0}
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export Roster</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs-container" style={{ marginBottom: '20px' }}>
        {availableSubjects.map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${selectedSubjectFilter === cat ? 'active' : ''}`}
            onClick={() => setSelectedSubjectFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Assignments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredList.length === 0 ? (
          <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No homework assignments found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {selectedSubjectFilter !== 'All'
                  ? `No homework assigned for ${selectedSubjectFilter}.`
                  : 'No coursework has been assigned yet. Click "Assign Homework" to create one.'}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsCreateModalOpen(true)}
                style={{ marginTop: '8px' }}
              >
                <Plus size={14} />
                <span>Assign First Homework</span>
              </button>
            </div>
          </div>
        ) : (
          filteredList.map((hw) => {
            const total = hw.totalCount || 0;
            const submitted = hw.submittedCount || 0;
            const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
            return (
              <div key={hw.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-purple">{hw.subject}</span>
                      <span className="badge badge-gray">{hw.class}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{hw.title}</h3>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Due Date</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#EF4444' }}>{hw.dueDate || '—'}</div>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '8px 0 16px 0' }}>
                  {hw.description || 'No special instructions provided.'}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '14px',
                    borderTop: '1px solid #F1F5F9',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                      Submissions: <strong>{submitted} / {total}</strong> ({pct}%)
                    </div>
                    <div style={{ width: '100px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 80 ? '#10B981' : '#F59E0B' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '12.5px' }}
                      onClick={() => handleOpenReview(hw)}
                    >
                      Review Submissions
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '5px 12px', fontSize: '12.5px' }}
                      onClick={() =>
                        showToast(
                          `Reminder queued for ${Math.max(0, total - submitted)} pending students.`,
                          'info'
                        )
                      }
                    >
                      Send Reminder
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Submissions Modal */}
      {reviewingHw && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Submissions: {reviewingHw.title}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {reviewingHw.class} · {reviewingHw.subject} · Due {reviewingHw.dueDate}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setReviewingHw(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '0px' }}>
              <div className="table-responsive">
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Student</th>
                      <th>Turned In</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Document</th>
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
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#6366F1' }}>
                            {sub.rollNo || '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>
                            {sub.name}
                          </td>
                          <td style={{ fontSize: '12px', color: '#64748B' }}>{sub.submittedAt}</td>
                          <td style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{sub.marks}</td>
                          <td>
                            <select
                              className="form-control"
                              style={{ padding: '3px 8px', fontSize: '12px', width: 'auto' }}
                              value={sub.status}
                              onChange={(e) => handleUpdateStatus(sub.id, e.target.value as any)}
                            >
                              <option value="Reviewed">Reviewed</option>
                              <option value="Pending Review">Pending Review</option>
                              <option value="Resubmission Required">Resubmission Required</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleDownloadStudentWork(sub)}
                            >
                              <Download size={12} />
                              <span>Work</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setReviewingHw(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Assign New Homework</h3>
              <button className="btn-icon" onClick={() => setIsCreateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Exercise 8.4 Trigonometric Identities"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Target Cohort
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Class 10 - A"
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Subject
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Mathematics"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Instructions / Problem List
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Enter question numbers or homework instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

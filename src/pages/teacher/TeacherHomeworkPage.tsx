import React, { useState } from 'react';
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
import { MOCK_HOMEWORK } from '../../data/mockData';
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
  const { showToast } = useApp();
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(MOCK_HOMEWORK);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [reviewingHw, setReviewingHw] = useState<HomeworkItem | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');

  // Form states
  const [title, setTitle] = useState<string>('');
  const [targetClass, setTargetClass] = useState<string>('Class 10 - A');
  const [subject, setSubject] = useState<string>('Mathematics');
  const [dueDate, setDueDate] = useState<string>('29 Oct 2026');
  const [description, setDescription] = useState<string>('');

  // Mock Student Submissions State for the modal
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([
    { id: 'sub-1', name: 'Aditya Sharma', rollNo: '10A01', submittedAt: 'Yesterday, 04:30 PM', status: 'Reviewed', marks: '19/20' },
    { id: 'sub-2', name: 'Ananya Verma', rollNo: '10A02', submittedAt: 'Yesterday, 06:15 PM', status: 'Reviewed', marks: '18/20' },
    { id: 'sub-3', name: 'Kavya Sharma', rollNo: '10A03', submittedAt: 'Today, 08:20 AM', status: 'Pending Review', marks: '-' },
    { id: 'sub-4', name: 'Charan Kumar', rollNo: '10A04', submittedAt: 'Today, 09:10 AM', status: 'Pending Review', marks: '-' },
    { id: 'sub-5', name: 'Rohan Deshmukh', rollNo: '10A05', submittedAt: 'Yesterday, 08:00 PM', status: 'Resubmission Required', marks: '12/20' }
  ]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      showToast('Please provide homework title', 'warning');
      return;
    }

    const newItem: HomeworkItem = {
      id: `hw-${Date.now()}`,
      title,
      class: targetClass,
      subject,
      assignedDate: '28 Oct 2026',
      dueDate,
      description,
      submittedCount: 0,
      totalCount: targetClass.includes('10') ? 32 : 24,
      assignedBy: 'Priya Sharma'
    };

    setHomeworkList([newItem, ...homeworkList]);
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
      Submitted: `${hw.submittedCount} / ${hw.totalCount}`
    }));
    downloadCSV('teacher_homework_roster.csv', data);
    showToast(`Exported ${data.length} homework records to CSV`, 'success');
  };

  const handleDownloadStudentWork = (sub: StudentSubmission) => {
    downloadSampleDocument(
      `${sub.name}_Homework_Submission.pdf`,
      `STUDENT HOMEWORK SUBMISSION\n\nStudent: ${sub.name} (${sub.rollNo})\nAssignment: ${reviewingHw?.title}\nSubject: ${reviewingHw?.subject}\nTurn-in Timestamp: ${sub.submittedAt}\nCurrent Status: ${sub.status}\nScore: ${sub.marks}\n\n[Teacher Feedback & Solution Verification Sheet]`
    );
    showToast(`Downloaded submission document for ${sub.name}`, 'success');
  };

  const handleUpdateStatus = (id: string, newStatus: StudentSubmission['status']) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    showToast(`Status updated to ${newStatus}`, 'info');
  };

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
        {['All', 'Mathematics', 'Science'].map((cat) => (
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
        {filteredList.map((hw) => {
          const total = hw.totalCount || 30;
          const submitted = hw.submittedCount || 0;
          const pct = Math.round((submitted / total) * 100);
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
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#EF4444' }}>{hw.dueDate}</div>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '8px 0 16px 0' }}>
                {hw.description}
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
                    Submissions: <strong>{hw.submittedCount} / {hw.totalCount}</strong> ({pct}%)
                  </div>
                  <div style={{ width: '100px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 80 ? '#10B981' : '#F59E0B' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '12.5px' }}
                    onClick={() => setReviewingHw(hw)}
                  >
                    Review Submissions
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '5px 12px', fontSize: '12.5px' }}
                    onClick={() =>
                      showToast(
                        `[Demo Mode] Simulated reminder dispatched to ${total - submitted} pending students. Live SMS/WhatsApp integration required.`,
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
        })}
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
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#6366F1' }}>
                          {sub.rollNo}
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
                    ))}
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
                    <select
                      className="form-control"
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                    >
                      <option value="Class 10 - A">Class 10 - A</option>
                      <option value="Class 9 - B">Class 9 - B</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Subject
                    </label>
                    <select
                      className="form-control"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    >
                      <option value="Mathematics">Mathematics</option>
                      <option value="Science">Science</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Submission Deadline *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Instructions / Problem Numbers
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Specify exercise questions or reference notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

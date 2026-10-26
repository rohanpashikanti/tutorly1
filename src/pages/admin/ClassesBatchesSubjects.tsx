import React, { useState } from 'react';
import {
  Layers,
  Users,
  BookOpen,
  Calendar,
  Plus,
  Search,
  MoreVertical,
  X,
  Edit2,
  Clock,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClassItem, BatchItem, SubjectItem, Teacher } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';

export const ClassesBatchesSubjects: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<'Classes' | 'Batches' | 'Subjects'>('Classes');
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [batchesList, setBatchesList] = useState<BatchItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadAcademics = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [res, teachersRes] = await Promise.all([
        api.academics.getOverview(activeInstitutionId),
        api.teachers.list(activeInstitutionId).catch(() => ({ teachers: [] })),
      ]);
      const classes = res?.classes || [];
      const batches = res?.batches || [];
      const subjects = res?.subjects || [];
      setClassesList(classes);
      setBatchesList(batches);
      setSubjectsList(subjects);
      setTeachers(teachersRes?.teachers || []);
      setSelectedClass(classes.length > 0 ? (prev => prev ? classes.find(c => c.id === prev.id) || classes[0] : classes[0]) : null);
    } catch (err) {
      console.error('Error fetching academics from D1:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load academic records');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  React.useEffect(() => {
    void loadAcademics();
  }, [loadAcademics]);

  const [newClassName, setNewClassName] = useState('');
  const [newClassTeacher, setNewClassTeacher] = useState('');

  const [editClassName, setEditClassName] = useState('');
  const [editClassTeacher, setEditClassTeacher] = useState('');

  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchClass, setNewBatchClass] = useState('');
  const [newBatchTiming, setNewBatchTiming] = useState('04:30 PM - 06:30 PM');
  const [newBatchTeacher, setNewBatchTeacher] = useState('');

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectIsCore, setNewSubjectIsCore] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.academics.createClass(activeInstitutionId, { name: newClassName });
      setShowAddClassModal(false);
      setNewClassName('');
      showToast(`Created class ${newClassName} successfully!`, 'success');
      await loadAcademics();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create class', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.academics.createBatch(activeInstitutionId, {
        className: newBatchClass,
        name: newBatchName,
        timing: newBatchTiming,
      });
      setShowAddBatchModal(false);
      setNewBatchName('');
      showToast(`Created ${newBatchName} under ${newBatchClass}!`, 'success');
      await loadAcademics();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.academics.createSubject(activeInstitutionId, {
        name: newSubjectName,
        code: newSubjectCode,
        isCore: newSubjectIsCore,
      });
      setShowAddSubjectModal(false);
      setNewSubjectName('');
      setNewSubjectCode('');
      showToast(`Added subject ${newSubjectName}!`, 'success');
      await loadAcademics();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create subject', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditClass = (cls: ClassItem) => {
    setEditClassName(cls.name);
    setEditClassTeacher(cls.classTeacher);
    setShowEditClassModal(true);
  };

  const handleSaveEditClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    const updated = classesList.map((c) =>
      c.id === selectedClass.id
        ? { ...c, name: editClassName, classTeacher: editClassTeacher }
        : c
    );
    setClassesList(updated);
    setSelectedClass({ ...selectedClass, name: editClassName, classTeacher: editClassTeacher });
    setShowEditClassModal(false);
    showToast(`Updated details for ${editClassName}`, 'success');
  };

  const handleExportCSV = () => {
    if (activeTab === 'Classes') {
      const data = classesList.map((c) => ({
        Class: c.name,
        Code: c.code,
        Batches: c.sections.join('; '),
        Students: c.totalStudents,
        Teacher: c.classTeacher,
        Status: c.status,
      }));
      downloadCSV('Classes_List.csv', data);
      showToast(`Exported ${data.length} classes to CSV`, 'success');
    } else if (activeTab === 'Batches') {
      const data = batchesList.map((b) => ({
        Batch: b.name,
        Class: b.className,
        Timing: b.timing,
        Days: b.days.join(', '),
        Students: b.studentsCount,
        Teacher: b.teacher,
      }));
      downloadCSV('Batches_List.csv', data);
      showToast(`Exported ${data.length} batches to CSV`, 'success');
    } else {
      const data = subjectsList.map((s) => ({
        Subject: s.name,
        Code: s.code,
        Type: s.isCore ? 'Core' : 'Optional',
        Classes: s.classes.join(', '),
      }));
      downloadCSV('Subjects_List.csv', data);
      showToast(`Exported ${data.length} subjects to CSV`, 'success');
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Classes & Batches</span>
            <span>›</span>
            <span>{activeTab}</span>
          </div>
          <h1>Classes, Batches & Subjects</h1>
          <p>Manage your classes, batches and subjects. Assign teachers and configure subjects for each batch.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (activeTab === 'Classes') setShowAddClassModal(true);
              else if (activeTab === 'Batches') setShowAddBatchModal(true);
              else setShowAddSubjectModal(true);
            }}
          >
            <Plus size={16} />
            <span>Add {activeTab === 'Classes' ? 'Class' : activeTab === 'Batches' ? 'Batch' : 'Subject'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'Classes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Classes')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Layers size={16} />
          <span>Classes</span>
        </button>
        <button
          className={`btn ${activeTab === 'Batches' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Batches')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Clock size={16} />
          <span>Batches</span>
        </button>
        <button
          className={`btn ${activeTab === 'Subjects' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('Subjects')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <BookOpen size={16} />
          <span>Subjects</span>
        </button>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadAcademics()}>Retry</button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Classes</div>
            <div className="stat-value">{isLoading ? '—' : classesList.length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Configured academic classes</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Batches</div>
            <div className="stat-value">{isLoading ? '—' : batchesList.length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across all classes</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <BookOpen size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Subjects</div>
            <div className="stat-value">{isLoading ? '—' : subjectsList.length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Core & Optional</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Enrollments</div>
            <div className="stat-value">{isLoading ? '—' : batchesList.reduce((acc, b) => acc + (b.studentsCount || 0), 0)}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across all batches</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: '100%' }}>
        
        {/* Table Column */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-field" style={{ minWidth: '240px' }}>
              <Search size={15} className="field-icon" />
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* 1. Classes Tab Table */}
          {activeTab === 'Classes' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}><input type="checkbox" /></th>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Class Name</th>
                    <th>Sections / Batches</th>
                    <th>Total Students</th>
                    <th>Subjects</th>
                    <th>Class Teacher</th>
                    <th>Status</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {classesList.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                        <Layers size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                          No classes found
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          No classes configured yet. Click "Add Class" to set up your first class.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    classesList.map((cls, idx) => {
                      return (
                        <tr key={cls.id}>
                          <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                          <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                                {cls.code}
                              </div>
                              <span style={{ fontWeight: 700, color: '#0F172A' }}>{cls.name}</span>
                            </div>
                          </td>
                          <td>{cls.sections.length} Batches</td>
                          <td><strong>{cls.totalStudents}</strong></td>
                          <td>{cls.subjectsCount} Subjects</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={cls.teacherAvatar} alt={cls.classTeacher} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                              <span>{cls.classTeacher}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-success">{cls.status}</span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenEditClass(cls)}
                              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#6366F1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                              title="Edit Class"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 2. Batches Tab Table */}
          {activeTab === 'Batches' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch Name</th>
                    <th>Class</th>
                    <th>Timings</th>
                    <th>Days</th>
                    <th>Enrolled Students</th>
                    <th>Primary Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                        <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                          No batches found
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          No batches configured yet. Click "Add Batch" to set up your first batch.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    batchesList.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>{b.name}</td>
                        <td><span className="badge badge-purple">{b.className}</span></td>
                        <td><span style={{ color: '#475569', fontSize: '13px' }}>{b.timing}</span></td>
                        <td><span style={{ fontSize: '12px', color: '#64748B' }}>{b.days.join(', ')}</span></td>
                        <td><strong>{b.studentsCount} Students</strong></td>
                        <td>{b.teacher}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. Subjects Tab Table */}
          {activeTab === 'Subjects' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Subject Code</th>
                    <th>Type</th>
                    <th>Applicable Classes</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                        <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                          No subjects found
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          No subjects configured yet. Click "Add Subject" to define curriculum subjects.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    subjectsList.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: sub.color }} />
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{sub.name}</span>
                          </div>
                        </td>
                        <td><code>{sub.code}</code></td>
                        <td>
                          <span className={`badge ${sub.isCore ? 'badge-purple' : 'badge-neutral'}`}>
                            {sub.isCore ? 'Core Subject' : 'Optional'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: '#64748B' }}>{sub.classes.join(', ')}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowAddClassModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Class</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowAddClassModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleAddClass}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 5"
                    value={newClassName}
                    disabled={isSubmitting}
                    onChange={(e) => setNewClassName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assign Class Teacher</label>
                  <select
                    value={newClassTeacher}
                    disabled={isSubmitting}
                    onChange={(e) => setNewClassTeacher(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="">-- Unassigned --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>{t.name} ({t.subject || (t.subjects && t.subjects[0]) || 'Faculty'})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowAddClassModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowAddBatchModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Batch</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowAddBatchModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleAddBatch}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Batch D (Weekend)"
                    value={newBatchName}
                    disabled={isSubmitting}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class *</label>
                    <select
                      required
                      value={newBatchClass}
                      disabled={isSubmitting}
                      onChange={(e) => setNewBatchClass(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="">Select Class</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Teacher</label>
                    <select
                      value={newBatchTeacher}
                      disabled={isSubmitting}
                      onChange={(e) => setNewBatchTeacher(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="">-- Unassigned --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Timings</label>
                  <input
                    type="text"
                    value={newBatchTiming}
                    disabled={isSubmitting}
                    onChange={(e) => setNewBatchTiming(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowAddBatchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowAddSubjectModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Subject</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowAddSubjectModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleAddSubject}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Science"
                      value={newSubjectName}
                      disabled={isSubmitting}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject Code</label>
                    <input
                      type="text"
                      placeholder="CS101"
                      value={newSubjectCode}
                      disabled={isSubmitting}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newSubjectIsCore}
                      disabled={isSubmitting}
                      onChange={(e) => setNewSubjectIsCore(e.target.checked)}
                    />
                    <span>Core Mandatory Subject</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowAddSubjectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditClassModal && selectedClass && (
        <div className="modal-backdrop" onClick={() => setShowEditClassModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Class — {selectedClass.name}</h2>
              <button onClick={() => setShowEditClassModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleSaveEditClass}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class Name *</label>
                  <input
                    type="text"
                    required
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class Teacher</label>
                  <input
                    type="text"
                    value={editClassTeacher}
                    onChange={(e) => setEditClassTeacher(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditClassModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

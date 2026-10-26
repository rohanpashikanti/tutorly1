import React, { useState } from 'react';
import {
  UserCheck,
  Users,
  Layers,
  BookOpen,
  Search,
  Plus,
  X,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Send,
  Calendar,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Teacher } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { Download } from 'lucide-react';
import { api } from '../../api/client';
import { getStoredTeachers, saveStoredTeachers } from '../../utils/storage';

export const TeacherManagement: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [teachers, setTeachers] = useState<Teacher[]>(() => getStoredTeachers());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDrawerTeacher, setActiveDrawerTeacher] = useState<Teacher | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addTeacherIdempotencyKey, setAddTeacherIdempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
  );

  const handleOpenAddModal = () => {
    setAddTeacherIdempotencyKey(
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
    );
    setShowAddModal(true);
  };

  const loadTeachers = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.teachers.list(activeInstitutionId);
      const list = res.teachers || [];
      setTeachers(list);
      saveStoredTeachers(list);
      if (list.length > 0) {
        setActiveDrawerTeacher((prev) => (prev ? list.find((t) => t.id === prev.id) || list[0] : list[0]));
      } else {
        setActiveDrawerTeacher(null);
      }
    } catch (err) {
      console.error('Error fetching teachers from D1:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  React.useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const [newTeacherData, setNewTeacherData] = useState({
    name: '',
    designation: 'Faculty',
    email: '',
    phone: '',
    gender: 'Female' as const,
    subjects: 'Mathematics, Science',
    classes: 'Class 10 (A), Class 9 (A)',
  });

  const [editTeacherData, setEditTeacherData] = useState<{
    name: string;
    designation: string;
    email: string;
    phone: string;
    subjects: string;
    classes: string;
    status: 'Active' | 'Inactive';
  }>({
    name: '',
    designation: '',
    email: '',
    phone: '',
    subjects: '',
    classes: '',
    status: 'Active',
  });

  const filteredTeachers = teachers.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subjects.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTeacherIds(filteredTeachers.map((t) => t.id));
    } else {
      setSelectedTeacherIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setEditTeacherData({
      name: teacher.name,
      designation: teacher.designation,
      email: teacher.email,
      phone: teacher.phone,
      subjects: teacher.subjects.join(', '),
      classes: teacher.classes.join(', '),
      status: teacher.status,
    });
    setShowEditModal(true);
  };

  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawerTeacher) return;

    const previousTeacher = activeDrawerTeacher;
    const previousTeachers = [...teachers];
    const teacherName = editTeacherData.name;

    const updatedTeacher: Teacher = {
      ...previousTeacher,
      name: editTeacherData.name,
      designation: editTeacherData.designation,
      phone: editTeacherData.phone,
      status: editTeacherData.status,
      subjects: editTeacherData.subjects.split(',').map(s => s.trim()).filter(Boolean),
      classes: editTeacherData.classes.split(',').map(c => c.trim()).filter(Boolean),
    };

    // Optimistically update screen immediately
    setTeachers(prev => prev.map(t => t.id === previousTeacher.id ? updatedTeacher : t));
    setActiveDrawerTeacher(updatedTeacher);
    setShowEditModal(false);
    showToast(`Updated teacher details for ${teacherName}`, 'success');

    // Background server call
    api.teachers.update(activeInstitutionId, previousTeacher.id, {
      name: editTeacherData.name,
      designation: editTeacherData.designation,
      phone: editTeacherData.phone,
      status: editTeacherData.status,
      subjects: editTeacherData.subjects,
      classes: editTeacherData.classes,
    }).then(() => {
      void loadTeachers();
    }).catch(err => {
      // Rollback on failure
      setTeachers(previousTeachers);
      setActiveDrawerTeacher(previousTeacher);
      showToast(err instanceof Error ? err.message : 'Failed to update teacher', 'error', {
        label: 'Retry',
        onClick: () => {
          handleOpenEdit(updatedTeacher);
        }
      });
    });
  };

  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState<Teacher | null>(null);

  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.teachers.delete(activeInstitutionId, teacher.id);
      showToast(`Teacher ${teacher.name} has been removed.`, 'success');
      setDeleteConfirmTeacher(null);
      if (activeDrawerTeacher?.id === teacher.id) {
        setActiveDrawerTeacher(null);
      }
      await loadTeachers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete teacher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = (selectedTeacherIds.length > 0
      ? teachers.filter((t) => selectedTeacherIds.includes(t.id))
      : filteredTeachers
    ).map((t) => ({
      Code: t.code,
      Name: t.name,
      Designation: t.designation,
      Email: t.email,
      Phone: t.phone,
      Subjects: t.subjects.join('; '),
      Classes: t.classes.join('; '),
      Status: t.status,
      TotalStudents: t.totalStudents,
    }));
    downloadCSV('Teachers_List.csv', dataToExport);
    showToast(`Exported ${dataToExport.length} teachers to CSV`, 'success');
  };

  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.teachers.create(activeInstitutionId, {
        ...newTeacherData,
        idempotencyKey: addTeacherIdempotencyKey,
      });
      setShowAddModal(false);
      showToast(`Teacher ${newTeacherData.name} onboarded successfully!`, 'success');
      setNewTeacherData({
        name: '',
        designation: 'Faculty',
        email: '',
        phone: '',
        gender: 'Female',
        subjects: 'Mathematics, Science',
        classes: 'Class 10 (A), Class 9 (A)',
      });
      setAddTeacherIdempotencyKey(
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
      );
      await loadTeachers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add teacher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Teachers</span>
            <span>›</span>
            <span>Teacher Management</span>
          </div>
          <h1>Teacher Management</h1>
          <p>Manage your teachers, their subjects, classes, and workloads.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            <span>Add Teacher</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadTeachers()}>Retry</button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Teachers</div>
            <div className="stat-value">{isLoading ? '—' : teachers.length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Onboarded faculty</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Teachers</div>
            <div className="stat-value">{isLoading ? '—' : teachers.filter(t => t.status === 'Active').length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Currently assigned</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes Assigned</div>
            <div className="stat-value">{isLoading ? '—' : teachers.reduce((acc, t) => acc + (t.classes?.length || 0), 0)}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across all teachers</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <BookOpen size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Subjects Covered</div>
            <div className="stat-value">{isLoading ? '—' : new Set(teachers.flatMap(t => t.subjects || [])).size}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across all teachers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Table + Drawer */}
      <div className={activeDrawerTeacher ? "grid-split-sidebar" : ""} style={{ width: '100%' }}>
        
        {/* Table Card */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-field" style={{ minWidth: '260px' }}>
              <Search size={15} className="field-icon" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {selectedTeacherIds.length > 0 && (
                <span style={{ fontSize: '12.5px', color: '#6366F1', fontWeight: 600 }}>
                  {selectedTeacherIds.length} selected
                </span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={filteredTeachers.length > 0 && selectedTeacherIds.length === filteredTeachers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Teacher Name</th>
                  <th>Subjects</th>
                  <th>Classes & Batches</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                        No teachers found
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {teachers.length === 0 ? 'No faculty members onboarded yet. Click "Add Teacher" to add your first faculty member.' : 'No teachers match the search criteria.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher, idx) => {
                    const isSelected = activeDrawerTeacher?.id === teacher.id;
                    const isChecked = selectedTeacherIds.includes(teacher.id);
                    return (
                      <tr
                        key={teacher.id}
                        onClick={() => setActiveDrawerTeacher(teacher)}
                        style={{ cursor: 'pointer', backgroundColor: isSelected ? '#F5F3FF' : undefined }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(teacher.id)}
                          />
                        </td>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <div className="user-table-cell">
                            <img src={teacher.avatar} alt={teacher.name} className="user-table-avatar" />
                            <div>
                              <div className="user-table-name">{teacher.name}</div>
                              <div className="user-table-sub">{teacher.code}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {teacher.subjects.map((s, i) => (
                              <span key={i} className="badge badge-purple" style={{ fontSize: '11px' }}>{s}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12.5px', color: '#475569' }}>
                            {teacher.classes.join(', ')}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>
                            <div style={{ fontWeight: 500 }}>{teacher.phone}</div>
                            <div style={{ color: '#64748B' }}>{teacher.email}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${teacher.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                            {teacher.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <button
                              onClick={() => handleOpenEdit(teacher)}
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#6366F1', cursor: 'pointer' }}
                              title="Edit Teacher"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmTeacher(teacher)}
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}
                              title="Delete Teacher"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => setActiveDrawerTeacher(teacher)}
                              style={{ padding: '5px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
                              title="View Details"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Drawer Card */}
        {activeDrawerTeacher && (
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={activeDrawerTeacher.avatar} alt={activeDrawerTeacher.name} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeDrawerTeacher.name}</h3>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{activeDrawerTeacher.designation} • {activeDrawerTeacher.code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-success">{activeDrawerTeacher.status}</span>
                  <button onClick={() => setActiveDrawerTeacher(null)} style={{ padding: '4px', color: '#94A3B8' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px', background: '#F8FAFC', borderRadius: '10px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeDrawerTeacher.totalStudents}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Students</div>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeDrawerTeacher.totalClasses}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Classes</div>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeDrawerTeacher.subjects.length}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Subjects</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Personal Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Mail size={14} color="#6366F1" />
                    <span>{activeDrawerTeacher.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Phone size={14} color="#6366F1" />
                    <span>{activeDrawerTeacher.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Calendar size={14} color="#6366F1" />
                    <span>DOB: {activeDrawerTeacher.dob} ({activeDrawerTeacher.gender})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <MapPin size={14} color="#6366F1" />
                    <span>{activeDrawerTeacher.address}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Subjects Taught
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {activeDrawerTeacher.subjects.map((sub, i) => (
                    <span key={i} className="badge badge-purple" style={{ padding: '4px 10px', fontSize: '12px' }}>{sub}</span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Assigned Classes & Batches
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {activeDrawerTeacher.classes.map((c, i) => (
                    <span key={i} className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: '12px', background: '#F1F5F9' }}>{c}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                  onClick={() => handleOpenEdit(activeDrawerTeacher)}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '8px', fontSize: '13px', color: '#DC2626', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                  onClick={() => setDeleteConfirmTeacher(activeDrawerTeacher)}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Teacher</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowAddModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleAddTeacherSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. S. Ramakrishna"
                      value={newTeacherData.name}
                      disabled={isSubmitting}
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Designation</label>
                    <input
                      type="text"
                      value={newTeacherData.designation}
                      disabled={isSubmitting}
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, designation: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="teacher@example.com"
                      value={newTeacherData.email}
                      disabled={isSubmitting}
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="98765 00000"
                      value={newTeacherData.phone}
                      disabled={isSubmitting}
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subjects (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics, Science"
                    value={newTeacherData.subjects}
                    disabled={isSubmitting}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, subjects: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assigned Classes (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Class 10 (A), Class 9 (A)"
                    value={newTeacherData.classes}
                    disabled={isSubmitting}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, classes: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Onboarding...' : 'Onboard Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && activeDrawerTeacher && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Teacher — {activeDrawerTeacher.name}</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setShowEditModal(false)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleEditTeacherSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editTeacherData.name}
                      disabled={isSubmitting}
                      onChange={(e) => setEditTeacherData({ ...editTeacherData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Designation</label>
                    <input
                      type="text"
                      value={editTeacherData.designation}
                      disabled={isSubmitting}
                      onChange={(e) => setEditTeacherData({ ...editTeacherData, designation: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editTeacherData.email}
                      disabled={isSubmitting}
                      onChange={(e) => setEditTeacherData({ ...editTeacherData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={editTeacherData.phone}
                      disabled={isSubmitting}
                      onChange={(e) => setEditTeacherData({ ...editTeacherData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subjects (comma separated)</label>
                  <input
                    type="text"
                    value={editTeacherData.subjects}
                    disabled={isSubmitting}
                    onChange={(e) => setEditTeacherData({ ...editTeacherData, subjects: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assigned Classes (comma separated)</label>
                  <input
                    type="text"
                    value={editTeacherData.classes}
                    disabled={isSubmitting}
                    onChange={(e) => setEditTeacherData({ ...editTeacherData, classes: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTeacher && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setDeleteConfirmTeacher(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#DC2626' }}>Remove Teacher</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setDeleteConfirmTeacher(null)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
                Are you sure you want to remove <strong>{deleteConfirmTeacher.name}</strong> ({deleteConfirmTeacher.code})?
                This faculty member will be removed from all assigned classes and subjects.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => !isSubmitting && setDeleteConfirmTeacher(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }}
                disabled={isSubmitting}
                onClick={() => handleDeleteTeacher(deleteConfirmTeacher)}
              >
                {isSubmitting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

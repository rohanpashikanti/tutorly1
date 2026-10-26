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
  Send,
  Calendar,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOCK_TEACHERS } from '../../data/mockData';
import { Teacher } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { Download } from 'lucide-react';
import { api } from '../../api/client';

export const TeacherManagement: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [teachers, setTeachers] = useState<Teacher[]>(MOCK_TEACHERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDrawerTeacher, setActiveDrawerTeacher] = useState<Teacher | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const loadTeachers = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    try {
      const res = await api.teachers.list(activeInstitutionId);
      if (res.teachers && res.teachers.length > 0) {
        setTeachers(res.teachers);
        setActiveDrawerTeacher((prev) => prev || res.teachers[0]);
      }
    } catch (err) {
      console.error('Error fetching teachers from D1:', err);
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
    try {
      await api.teachers.update(activeInstitutionId, activeDrawerTeacher.id, {
        name: editTeacherData.name,
        designation: editTeacherData.designation,
        phone: editTeacherData.phone,
        status: editTeacherData.status,
      });
      setShowEditModal(false);
      showToast(`Updated teacher details for ${editTeacherData.name}`, 'success');
      await loadTeachers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update teacher', 'error');
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
    try {
      await api.teachers.create(activeInstitutionId, newTeacherData);
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
      await loadTeachers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add teacher', 'error');
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
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            <span>Add Teacher</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Teachers</div>
            <div className="stat-value">12</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +2</span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Teachers</div>
            <div className="stat-value">10</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +11%</span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes Assigned</div>
            <div className="stat-value">28</div>
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
            <div className="stat-value">8</div>
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
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher, idx) => {
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
                        <ChevronRight size={16} color="#94A3B8" />
                      </td>
                    </tr>
                  );
                })}
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '8px' }}
                  onClick={() => handleOpenEdit(activeDrawerTeacher)}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '8px' }}
                  onClick={() => showToast(`[Demo Mode] Simulated message queued for ${activeDrawerTeacher.name}. Live SMS/WhatsApp integration required.`, 'info')}
                >
                  <Send size={14} />
                  <span>Message</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Teacher</h2>
              <button onClick={() => setShowAddModal(false)}><X size={20} color="#64748B" /></button>
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
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Designation</label>
                    <input
                      type="text"
                      value={newTeacherData.designation}
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
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subjects (comma separated)</label>
                  <input
                    type="text"
                    value={newTeacherData.subjects}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, subjects: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Onboard Teacher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {showEditModal && activeDrawerTeacher && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Teacher — {activeDrawerTeacher.name}</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} color="#64748B" /></button>
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
                      onChange={(e) => setEditTeacherData({ ...editTeacherData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Designation</label>
                    <input
                      type="text"
                      value={editTeacherData.designation}
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
                    onChange={(e) => setEditTeacherData({ ...editTeacherData, subjects: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Assigned Classes (comma separated)</label>
                  <input
                    type="text"
                    value={editTeacherData.classes}
                    onChange={(e) => setEditTeacherData({ ...editTeacherData, classes: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

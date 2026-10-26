import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  Filter,
  Plus,
  Download,
  MoreVertical,
  ChevronRight,
  X,
  Calendar,
  Phone,
  Mail,
  Award,
  CreditCard,
  BookOpen,
  ClipboardCheck,
  Edit2,
  Trash2,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Student, FeeRecord } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { ParentContactActions } from '../../components/common/ParentContactActions';
import {
  getStoredStudents,
  saveStoredStudents,
  getStoredStudentFees,
  saveStoredStudentFees
} from '../../utils/storage';
import { api } from '../../api/client';

export const StudentDirectory: React.FC = () => {
  const { navigateTo, showToast, activeInstitutionId } = useApp();
  const [students, setStudents] = useState<Student[]>(() => getStoredStudents());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedBatch, setSelectedBatch] = useState('All Batches');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [activeDrawerStudent, setActiveDrawerStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addStudentIdempotencyKey, setAddStudentIdempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
  );


  const loadStudents = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.students.list(activeInstitutionId);
      const studentList = res.students || [];
      setStudents(studentList);
      saveStoredStudents(studentList);
      if (studentList.length > 0) {
        setActiveDrawerStudent((prev) => (prev ? studentList.find(s => s.id === prev.id) || studentList[0] : studentList[0]));
      } else {
        setActiveDrawerStudent(null);
      }
    } catch (err) {
      console.error('Error fetching students from D1:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  React.useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (!activeInstitutionId) return;
    api.academics.getOverview(activeInstitutionId)
      .then((res) => {
        const cls = res?.classes || [];
        const bth = res?.batches || [];
        setAvailableClasses(cls);
        setAvailableBatches(bth);
        setFormData(prev => ({
          ...prev,
          class: prev.class || cls[0]?.name || '',
          batch: prev.batch || bth[0]?.name || ''
        }));
      })
      .catch(() => {});
  }, [activeInstitutionId]);

  const initialStudentFormData = {
    name: '',
    class: '',
    batch: '',
    gender: 'Male' as const,
    dob: '2010-05-15',
    fatherName: '',
    phone: '',
    email: '',
    tuitionFeeAmount: 0,
    billingFrequency: 'Monthly',
    initialPayment: 0,
    feeDueDate: ''
  };

  // New student form state including individual fee assignment
  const [formData, setFormData] = useState(initialStudentFormData);

  // Edit student form state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    class: '',
    batch: '',
    phone: '',
    email: '',
    fatherName: '',
  });

  const handleOpenAddModal = () => {
    setFormData({
      ...initialStudentFormData,
      class: availableClasses[0]?.name || '',
      batch: availableBatches[0]?.name || '',
    });
    setAddStudentIdempotencyKey(
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
    );
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    if (isSubmitting) return;
    setShowAddModal(false);
    setFormData({
      ...initialStudentFormData,
      class: availableClasses[0]?.name || '',
      batch: availableBatches[0]?.name || '',
    });
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      name: student.name || '',
      class: student.class || availableClasses[0]?.name || '',
      batch: student.batch || availableBatches[0]?.name || '',
      phone: student.parent?.phone || student.phone || '',
      email: student.parent?.email || student.email || '',
      fatherName: student.parent?.fatherName || student.parentName || '',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    if (isSubmitting) return;
    setShowEditModal(false);
    setEditingStudent(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const previousStudent = editingStudent;
    const previousStudents = [...students];
    const previousActiveDrawer = activeDrawerStudent;
    const studentName = editFormData.name;

    const updatedStudent: Student = {
      ...previousStudent,
      name: editFormData.name,
      class: editFormData.class,
      batch: editFormData.batch,
      phone: editFormData.phone,
      email: editFormData.email,
      parent: {
        ...previousStudent.parent,
        fatherName: editFormData.fatherName,
        phone: editFormData.phone,
        email: editFormData.email,
      }
    };

    // Optimistically update screen immediately
    setStudents(prev => prev.map(s => s.id === previousStudent.id ? updatedStudent : s));
    if (activeDrawerStudent?.id === previousStudent.id) {
      setActiveDrawerStudent(updatedStudent);
    }
    setShowEditModal(false);
    setEditingStudent(null);
    showToast(`Updated profile for ${studentName}`, 'success');

    // Background server call
    api.students.update(activeInstitutionId, previousStudent.id, {
      name: editFormData.name,
      phone: editFormData.phone,
      email: editFormData.email,
      fatherName: editFormData.fatherName,
      class: editFormData.class,
      batch: editFormData.batch,
    }).then(() => {
      void loadStudents();
    }).catch(err => {
      // Rollback on failure
      setStudents(previousStudents);
      setActiveDrawerStudent(previousActiveDrawer);
      showToast(err instanceof Error ? err.message : 'Failed to update student profile', 'error', {
        label: 'Retry',
        onClick: () => {
          handleOpenEdit(updatedStudent);
        }
      });
    });
  };

  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);

  const handleDeleteStudent = async (student: Student) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.students.delete(activeInstitutionId, student.id);
      showToast(`Student ${student.name} (${student.admissionNo}) has been removed.`, 'success');
      setDeleteConfirmStudent(null);
      if (activeDrawerStudent?.id === student.id) {
        setActiveDrawerStudent(null);
      }
      await loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete student', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Admission No', 'Roll No', 'Name', 'Class', 'Batch', 'Parent Name', 'Phone', 'Attendance Rate', 'Status'];
    const rows = filteredStudents.map((s) => [
      s.admissionNo,
      s.rollNo,
      s.name,
      s.class,
      s.batch,
      s.parent.fatherName,
      s.parent.phone,
      `${s.attendanceRate}%`,
      s.status
    ]);
    downloadCSV(`Students_Directory_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    showToast(`Exported ${filteredStudents.length} students to CSV`, 'success');
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parent.fatherName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'All Classes' || s.class === selectedClass;
    const matchesBatch = selectedBatch === 'All Batches' || s.batch === selectedBatch;
    const matchesStatus = selectedStatus === 'All Status' || s.status === selectedStatus;
    return matchesSearch && matchesClass && matchesBatch && matchesStatus;
  });

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const studentName = formData.name;
    try {
      await api.students.create(activeInstitutionId, {
        ...formData,
        idempotencyKey: addStudentIdempotencyKey,
      });
      setShowAddModal(false);
      setFormData({
        ...initialStudentFormData,
        class: availableClasses[0]?.name || '',
        batch: availableBatches[0]?.name || '',
      });
      showToast(`Student ${studentName} enrolled and tuition fee assigned!`, 'success');
      setAddStudentIdempotencyKey(
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`
      );
      await loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to enroll student', 'error');
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
            <span>Students</span>
            <span>›</span>
            <span>Student Directory</span>
          </div>
          <h1>Student Directory</h1>
          <p>Manage all your students, view their details, attendance, results and more.</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadStudents()}>Retry</button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{isLoading ? '—' : students.length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Enrolled in institute</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Students</div>
            <div className="stat-value">{isLoading ? '—' : students.filter(s => s.status === 'Active').length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Currently attending</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <UserPlus size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes Represented</div>
            <div className="stat-value">{isLoading ? '—' : new Set(students.map(s => s.class)).size}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Active grade levels</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <UserX size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Inactive Students</div>
            <div className="stat-value">{isLoading ? '—' : students.filter(s => s.status === 'Inactive').length}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Archived or withdrawn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Directory Table + Quick Info Drawer/Card */}
      <div className={activeDrawerStudent ? 'grid-split-balanced' : ''}>
        
        {/* Table Column */}
        <div className="card">
          {/* Filters Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="search-field" style={{ minWidth: '220px' }}>
              <Search size={15} className="field-icon" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="select-field"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option>All Classes</option>
              {availableClasses.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              className="select-field"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <option>All Batches</option>
              {availableBatches.map((b) => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
            </select>

            <select
              className="select-field"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          {/* Data Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(filteredStudents.map((s) => s.id));
                        } else {
                          setSelectedStudentIds([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Batch</th>
                  <th>Parent / Guardian</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                        No students found
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {students.length === 0 ? 'No students have been enrolled yet. Click "Add Student" to enroll your first student.' : 'No students match the current search and filter criteria.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => {
                    const isSelected = activeDrawerStudent?.id === student.id;
                    const isChecked = selectedStudentIds.includes(student.id);
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setActiveDrawerStudent(student)}
                        style={{ cursor: 'pointer', backgroundColor: isSelected ? '#F5F3FF' : undefined }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds([...selectedStudentIds, student.id]);
                              } else {
                                setSelectedStudentIds(selectedStudentIds.filter((id) => id !== student.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <div className="user-table-cell">
                            <img src={student.avatar} alt={student.name} className="user-table-avatar" />
                            <div>
                              <div className="user-table-name">{student.name}</div>
                              <div className="user-table-sub">{student.admissionNo}</div>
                            </div>
                          </div>
                        </td>
                        <td>{student.class}</td>
                        <td>{student.batch}</td>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{student.parent.fatherName}</div>
                            <div style={{ marginTop: '3px' }}>
                              <ParentContactActions
                                phone={student.parent.phone}
                                parentName={student.parent.fatherName}
                                studentName={student.name}
                                size="sm"
                                showNumber={true}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${student.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                            {student.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ width: '100px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>
                              <span>{student.attendanceRate}%</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${student.attendanceRate}%`,
                                  height: '100%',
                                  background: student.attendanceRate >= 85 ? '#6366F1' : '#F59E0B',
                                  borderRadius: '4px',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <button
                              onClick={() => handleOpenEdit(student)}
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#6366F1', cursor: 'pointer' }}
                              title="Edit Student"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmStudent(student)}
                              style={{ padding: '5px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}
                              title="Delete Student"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => navigateTo('student-profile', { studentId: student.id })}
                              style={{ padding: '5px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
                              title="View Profile"
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

          {/* Pagination Footer */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B' }}>
            <span>Showing {filteredStudents.length > 0 ? 1 : 0}-{filteredStudents.length} of {filteredStudents.length} students</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="btn btn-sm btn-secondary" disabled>‹</button>
              <button className="btn btn-sm btn-primary" style={{ minWidth: '28px', padding: '4px' }}>1</button>
              <button className="btn btn-sm btn-secondary" disabled>›</button>
            </div>
          </div>
        </div>

        {/* Right Student Quick Detail Panel */}
        {activeDrawerStudent && (
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={activeDrawerStudent.avatar} alt={activeDrawerStudent.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{activeDrawerStudent.name}</h3>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{activeDrawerStudent.admissionNo}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-success">{activeDrawerStudent.status}</span>
                  <button onClick={() => setActiveDrawerStudent(null)} style={{ padding: '4px', color: '#94A3B8' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Action Buttons in Drawer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                  onClick={() => navigateTo('student-profile', { studentId: activeDrawerStudent.id })}
                >
                  <span>View Full Profile</span>
                  <ChevronRight size={14} />
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '7px', fontSize: '12.5px' }}
                    onClick={() => handleOpenEdit(activeDrawerStudent)}
                  >
                    <Edit2 size={13} />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '7px', fontSize: '12.5px', color: '#DC2626', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                    onClick={() => setDeleteConfirmStudent(activeDrawerStudent)}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Details Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>Personal Information</span>
                  <span
                    style={{ fontSize: '11px', color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => handleOpenEdit(activeDrawerStudent)}
                  >
                    Edit
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>Full Name</div>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeDrawerStudent.name}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>Date of Birth</div>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeDrawerStudent.dob} ({activeDrawerStudent.age} yrs)</div>
                  </div>
                  <div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>Gender</div>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeDrawerStudent.gender}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>Admission Date</div>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeDrawerStudent.admissionDate}</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>Parent / Guardian</span>
                  <span
                    style={{ fontSize: '11px', color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => handleOpenEdit(activeDrawerStudent)}
                  >
                    Edit
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeDrawerStudent.parent.fatherName} (Father)</div>
                  <div>
                    <ParentContactActions
                      phone={activeDrawerStudent.parent.phone}
                      parentName={activeDrawerStudent.parent.fatherName}
                      studentName={activeDrawerStudent.name}
                      size="sm"
                      showNumber={true}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                    <Mail size={13} color="#6366F1" />
                    <span>{activeDrawerStudent.parent.email}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Quick Actions
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))', gap: '8px' }}>
                  <button
                    onClick={() => navigateTo('attendance-register')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <ClipboardCheck size={16} color="#6366F1" />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Attendance</span>
                  </button>
                  <button
                    onClick={() => navigateTo('tuition-test-results')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <Award size={16} color="#10B981" />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Results</span>
                  </button>
                  <button
                    onClick={() => navigateTo('fee-collection')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <CreditCard size={16} color="#F59E0B" />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Fees</span>
                  </button>
                  <button
                    onClick={() => navigateTo('school-exams')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px 4px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <FileText size={16} color="#EC4899" />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Exams</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={handleCloseAddModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Student</h2>
              <button disabled={isSubmitting} onClick={handleCloseAddModal}><X size={20} color="#64748B" /></button>
            </div>
            <form
              onSubmit={handleAddStudentSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div
                className="modal-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  flex: 1,
                  minHeight: 0
                }}
              >
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Srikant Reddy"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class *</label>
                    <select
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      required
                    >
                      {availableClasses.length === 0 ? (
                        <option value="">No classes configured</option>
                      ) : (
                        availableClasses.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <select
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      {availableBatches.length === 0 ? (
                        <option value="">No batches configured</option>
                      ) : (
                        availableBatches.map((b) => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>Parent / Guardian Details</div>
                  <div className="grid-2-col" style={{ gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Reddy"
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Contact Phone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="98765 00000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Individual Fee Assignment on Admission */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                    Tuition Fee Assignment (Student Specific)
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#64748B', marginBottom: '10px' }}>
                    Assign this student's individualized tuition fee directly during admission without complicated structure configuration.
                  </p>
                  <div className="grid-2-col" style={{ gap: '14px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Assigned Fee Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.tuitionFeeAmount}
                        onChange={(e) => setFormData({ ...formData, tuitionFeeAmount: Number(e.target.value) || 0 })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Billing Frequency / Period
                      </label>
                      <select
                        value={formData.billingFrequency}
                        onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Annually">Annually</option>
                        <option value="One-time">One-time / Full Course</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-2-col" style={{ gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Initial Paid Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formData.tuitionFeeAmount}
                        value={formData.initialPayment}
                        onChange={(e) => setFormData({ ...formData, initialPayment: Number(e.target.value) || 0 })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        First Due Date
                      </label>
                      <input
                        type="date"
                        value={formData.feeDueDate}
                        onChange={(e) => setFormData({ ...formData, feeDueDate: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={handleCloseAddModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <div className="modal-backdrop" onClick={handleCloseEditModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Student Profile — {editingStudent.name}</h2>
              <button disabled={isSubmitting} onClick={handleCloseEditModal}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <form
              onSubmit={handleSaveEdit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div
                className="modal-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  flex: 1,
                  minHeight: 0
                }}
              >
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class</label>
                    <select
                      value={editFormData.class}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      {availableClasses.length === 0 ? (
                        <option value="">No classes configured</option>
                      ) : (
                        availableClasses.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <select
                      value={editFormData.batch}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      {availableBatches.length === 0 ? (
                        <option value="">No batches configured</option>
                      ) : (
                        availableBatches.map((b) => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.fatherName}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Phone *</label>
                    <input
                      type="tel"
                      required
                      value={editFormData.phone}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      disabled={isSubmitting}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={handleCloseEditModal}
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
      {deleteConfirmStudent && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setDeleteConfirmStudent(null)}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#DC2626' }}>Remove Student</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setDeleteConfirmStudent(null)}>
                <X size={20} color="#64748B" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
                Are you sure you want to remove <strong>{deleteConfirmStudent.name}</strong> ({deleteConfirmStudent.admissionNo}) from the active student directory?
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => !isSubmitting && setDeleteConfirmStudent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#DC2626', borderColor: '#DC2626', color: '#fff' }}
                disabled={isSubmitting}
                onClick={() => handleDeleteStudent(deleteConfirmStudent)}
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

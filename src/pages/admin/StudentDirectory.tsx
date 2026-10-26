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
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOCK_STUDENTS } from '../../data/mockData';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedBatch, setSelectedBatch] = useState('All Batches');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [activeDrawerStudent, setActiveDrawerStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const loadStudents = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    try {
      const res = await api.students.list(activeInstitutionId);
      setStudents(res.students);
      if (res.students.length > 0) {
        setActiveDrawerStudent((prev) => prev || res.students[0]);
      }
    } catch (err) {
      console.error('Error fetching students from D1:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  React.useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  // New student form state including individual fee assignment
  const [formData, setFormData] = useState({
    name: '',
    class: 'Class 10',
    batch: 'Batch A',
    gender: 'Male' as const,
    dob: '2010-05-15',
    fatherName: '',
    phone: '',
    email: '',
    tuitionFeeAmount: 36000,
    billingFrequency: 'Monthly',
    initialPayment: 3000,
    feeDueDate: '2026-11-05'
  });

  // Edit student form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    class: 'Class 10',
    batch: 'Batch A',
    phone: '',
    email: '',
    fatherName: '',
  });

  const handleOpenEdit = (student: Student) => {
    setEditFormData({
      name: student.name,
      class: student.class,
      batch: student.batch,
      phone: student.parent.phone,
      email: student.parent.email,
      fatherName: student.parent.fatherName,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawerStudent) return;
    try {
      await api.students.update(activeInstitutionId, activeDrawerStudent.id, {
        name: editFormData.name,
        phone: editFormData.phone,
        email: editFormData.email,
      });
      setShowEditModal(false);
      showToast(`Updated profile for ${editFormData.name}`, 'success');
      await loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update student profile', 'error');
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
    try {
      await api.students.create(activeInstitutionId, formData);
      setShowAddModal(false);
      showToast(`Student ${formData.name} enrolled and tuition fee assigned!`, 'success');
      await loadStudents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to enroll student', 'error');
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
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            <span>Add Student</span>
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
            <div className="stat-label">Total Students</div>
            <div className="stat-value">248</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +12%</span>
              <span className="stat-subtext">vs last year</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Students</div>
            <div className="stat-value">232</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +8%</span>
              <span className="stat-subtext">vs last year</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <UserPlus size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">New Enrollments</div>
            <div className="stat-value">16</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +6%</span>
              <span className="stat-subtext">this term</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <UserX size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Inactive Students</div>
            <div className="stat-value">8</div>
            <div className="stat-footer">
              <span className="stat-badge-change negative">↓ -4%</span>
              <span className="stat-subtext">vs last year</span>
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
              <option>Class 10</option>
              <option>Class 9</option>
              <option>Class 8</option>
              <option>Class 7</option>
              <option>Class 6</option>
            </select>

            <select
              className="select-field"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <option>All Batches</option>
              <option>Batch A</option>
              <option>Batch B</option>
              <option>Batch C</option>
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
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => {
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
                        <button
                          onClick={() => navigateTo('student-profile', { studentId: student.id })}
                          style={{ padding: '6px', borderRadius: '6px', color: '#64748B' }}
                          title="View Profile"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B' }}>
            <span>Showing 1-8 of 248 students</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="btn btn-sm btn-secondary">‹</button>
              <button className="btn btn-sm btn-primary" style={{ minWidth: '28px', padding: '4px' }}>1</button>
              <button className="btn btn-sm btn-secondary" style={{ minWidth: '28px', padding: '4px' }}>2</button>
              <button className="btn btn-sm btn-secondary" style={{ minWidth: '28px', padding: '4px' }}>3</button>
              <span>...</span>
              <button className="btn btn-sm btn-secondary" style={{ minWidth: '28px', padding: '4px' }}>31</button>
              <button className="btn btn-sm btn-secondary">›</button>
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

              {/* View Full Profile CTA */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '8px', fontSize: '13px' }}
                onClick={() => navigateTo('student-profile', { studentId: activeDrawerStudent.id })}
              >
                <span>View Full Profile</span>
                <ChevronRight size={14} />
              </button>
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
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Student</h2>
              <button onClick={() => setShowAddModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleAddStudentSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    >
                      <option>Class 10</option>
                      <option>Class 9</option>
                      <option>Class 8</option>
                      <option>Class 7</option>
                      <option>Class 6</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <select
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Batch A</option>
                      <option>Batch B</option>
                      <option>Batch C</option>
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Enroll Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && activeDrawerStudent && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Student Profile — {activeDrawerStudent.name}</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class</label>
                    <select
                      value={editFormData.class}
                      onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Class 10</option>
                      <option>Class 9</option>
                      <option>Class 8</option>
                      <option>Class 7</option>
                      <option>Class 6</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Batch</label>
                    <select
                      value={editFormData.batch}
                      onChange={(e) => setEditFormData({ ...editFormData, batch: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Batch A</option>
                      <option>Batch B</option>
                      <option>Batch C</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.fatherName}
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
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Parent Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
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

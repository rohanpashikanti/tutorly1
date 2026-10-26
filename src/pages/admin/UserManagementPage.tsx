import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  Users,
  UserCheck,
  CheckCircle2,
  X,
  Layers,
  Download,
  Copy,
  KeyRound,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';

interface UserRecord {
  id: string;
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Admin' | 'Teacher' | 'Parent';
  rawRole: 'owner' | 'admin' | 'teacher' | 'parent';
  assigned: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  teacherProfile?: {
    id: string;
    teacherCode: string;
    designation: string;
    assignments: string[];
  } | null;
  guardianProfile?: {
    id: string;
    phone: string | null;
    linkedChildren: { id: string; name: string; class: string }[];
  } | null;
}

export const UserManagementPage: React.FC = () => {
  const { showToast, activeInstitutionId, currentUser } = useApp();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('All Users');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Provisioning Modal State
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Teacher' | 'Parent'>('Teacher');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserDesignation, setNewUserDesignation] = useState<string>('Senior Faculty');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [parentRelationship, setParentRelationship] = useState<string>('Parent');

  // Academic and Student data for assignment / linking
  const [academicClasses, setAcademicClasses] = useState<any[]>([]);
  const [academicBatches, setAcademicBatches] = useState<any[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);

  // Credential Display Modal (for created or reset passwords)
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    title: string;
    name: string;
    email: string;
    role: string;
    temporaryPassword?: string;
    isNew: boolean;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const refreshUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.users.list(activeInstitutionId);
      setUsers(res?.users || []);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load institution users');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [academics, studentsRes] = await Promise.all([
        api.academics.getOverview(activeInstitutionId).catch(() => null),
        api.students.list(activeInstitutionId).catch(() => null),
      ]);

      if (academics) {
        setAcademicClasses(academics.classes || []);
        setAcademicBatches(academics.batches || []);
        setAcademicSubjects(academics.subjects || []);
        if (academics.classes?.length > 0 && !selectedClassId) {
          setSelectedClassId(academics.classes[0].id);
        }
        if (academics.subjects?.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(academics.subjects[0].id);
        }
      }

      if (studentsRes && studentsRes.students) {
        setAvailableStudents(studentsRes.students);
      }
    } catch {
      // Ignore dependencies load failure
    }
  };

  useEffect(() => {
    if (activeInstitutionId) {
      void refreshUsers();
      void loadDependencies();
    }
  }, [activeInstitutionId]);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesTab =
      activeTab === 'All Users' ||
      (activeTab === 'Admins' && u.role === 'Admin') ||
      (activeTab === 'Teachers' && u.role === 'Teacher') ||
      (activeTab === 'Parents' && u.role === 'Parent');
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.assigned.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Provisioning Form Submission
  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole.toLowerCase(),
      };

      if (newUserRole === 'Teacher') {
        payload.designation = newUserDesignation.trim();
        payload.phone = newUserPhone.trim();
        if (selectedClassId && selectedSubjectId) {
          payload.assignments = [
            {
              classId: selectedClassId,
              batchId: selectedBatchId || undefined,
              subjectId: selectedSubjectId,
            },
          ];
        }
      } else if (newUserRole === 'Parent') {
        payload.phone = newUserPhone.trim();
        payload.relationship = parentRelationship;
        payload.studentIds = selectedChildIds;
      }

      const res = await api.users.create(activeInstitutionId, payload);

      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setSelectedChildIds([]);
      await refreshUsers();

      if (res.temporaryPassword) {
        setCredentialModal({
          isOpen: true,
          title: 'Account Provisioned Successfully',
          name: res.user.name,
          email: res.user.email,
          role: newUserRole,
          temporaryPassword: res.temporaryPassword,
          isNew: res.isNewAccount,
        });
      } else {
        showToast(`Access granted to existing account ${res.user.email}!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to provision account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Toggle (Active <-> Suspended)
  const toggleUserStatus = async (user: UserRecord) => {
    const newStatus = user.status === 'Active' ? 'suspended' : 'active';
    try {
      await api.users.updateStatus(activeInstitutionId, user.membershipId, newStatus);
      await refreshUsers();
      showToast(`Account for ${user.name} is now ${newStatus === 'active' ? 'Active' : 'Suspended'}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status', 'error');
    }
  };

  // Reset Password Action
  const handleResetPassword = async (user: UserRecord) => {
    try {
      const res = await api.users.resetPassword(activeInstitutionId, user.membershipId);
      setCredentialModal({
        isOpen: true,
        title: 'Password Reset Successfully',
        name: user.name,
        email: user.email,
        role: user.role,
        temporaryPassword: res.temporaryPassword,
        isNew: false,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    }
  };

  // Re-send Invitation
  const handleResendInvite = async (user: UserRecord) => {
    try {
      const res = await api.users.resendInvite(activeInstitutionId, user.membershipId);
      setCredentialModal({
        isOpen: true,
        title: 'Invitation Credentials Re-issued',
        name: user.name,
        email: user.email,
        role: user.role,
        temporaryPassword: res.temporaryPassword,
        isNew: false,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to reissue invitation', 'error');
    }
  };

  const handleCopyPassword = () => {
    if (credentialModal?.temporaryPassword) {
      void navigator.clipboard.writeText(credentialModal.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast('Temporary password copied to clipboard', 'success');
    }
  };

  const handleExportUsers = () => {
    const headers = ['Membership ID', 'Name', 'Email', 'Role', 'Assigned Scope', 'Status', 'Created Date'];
    const rows = filteredUsers.map((u) => [
      u.membershipId,
      u.name,
      u.email,
      u.role,
      u.assigned,
      u.status,
      u.createdAt ? u.createdAt.slice(0, 10) : '—',
    ]);
    downloadCSV(`Users_List_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    showToast(`Exported ${filteredUsers.length} accounts to CSV`, 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Admin Portal</span>
            <span>›</span>
            <span>User Management</span>
          </div>
          <h1>Users & Permissions</h1>
          <p>Provision staff and guardian access, manage roles, and enforce institution-scoped security.</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportUsers}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddUserOpen(true)}>
            <Plus size={16} />
            <span>Provision User</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontSize: '13px' }}>
            <AlertCircle size={16} />
            <span>{loadError}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refreshUsers}>Retry</button>
        </div>
      )}

      {/* 4 Metric Cards Derived Directly from Real State */}
      <div className="stat-grid-4" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Accounts</div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-footer"><span className="stat-subtext">Active memberships</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <UserCheck size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Faculty / Teachers</div>
            <div className="stat-value">{users.filter((u) => u.role === 'Teacher').length}</div>
            <div className="stat-footer"><span className="stat-subtext">Teaching accounts</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Parents / Guardians</div>
            <div className="stat-value">{users.filter((u) => u.role === 'Parent').length}</div>
            <div className="stat-footer"><span className="stat-subtext">Portal access</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <ShieldCheck size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Administrators</div>
            <div className="stat-value">{users.filter((u) => u.role === 'Admin').length}</div>
            <div className="stat-footer"><span className="stat-subtext">Center management</span></div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {['All Users', 'Admins', 'Teachers', 'Parents'].map((tab) => (
              <button
                key={tab}
                className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by name, email, or scope..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  height: '36px',
                }}
              />
            </div>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ width: '140px', height: '36px' }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Account</th>
                <th>Role</th>
                <th>Assigned Scope / Profile</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    Loading accounts…
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    {users.length === 0
                      ? 'No users provisioned in this institution yet. Click "Provision User" above to add faculty or parents.'
                      : `No accounts match "${searchQuery}" under ${activeTab}.`}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => handleSelectRow(u.id)}
                      />
                    </td>
                    <td>
                      <div className="user-table-cell">
                        <img src={u.avatar} alt={u.name} className="user-table-avatar" />
                        <div>
                          <div className="user-table-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {u.name}
                            {currentUser.email === u.email && (
                              <span style={{ fontSize: '10px', background: '#EEF2FF', color: '#4F46E5', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>You</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        u.role === 'Admin' ? 'badge-purple' :
                        u.role === 'Teacher' ? 'badge-info' : 'badge-success'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ color: '#475569', fontSize: '12.5px', maxWidth: '260px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.assigned}>
                        {u.assigned}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>
                      {u.createdAt ? u.createdAt.slice(0, 10) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title={u.status === 'Active' ? 'Suspend access and revoke sessions' : 'Activate access'}
                          onClick={() => toggleUserStatus(u)}
                        >
                          {u.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title="Generate new temporary password"
                          onClick={() => handleResetPassword(u)}
                        >
                          <KeyRound size={12} />
                          <span>Reset</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title="Reissue invitation setup credentials"
                          onClick={() => handleResendInvite(u)}
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      {isAddUserOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Provision New Account</h2>
              <button onClick={() => setIsAddUserOpen(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleProvisionUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      System Role *
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Teacher">Teacher / Faculty</option>
                      <option value="Parent">Parent / Guardian</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Teacher-Specific Assignment Fields */}
                {newUserRole === 'Teacher' && (
                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Faculty Profile & Assignments</div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px' }}>Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Faculty / Physics HOD"
                        value={newUserDesignation}
                        onChange={(e) => setNewUserDesignation(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div className="grid-2-col" style={{ gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px' }}>Assigned Class</label>
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        >
                          <option value="">Select class…</option>
                          {academicClasses.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px' }}>Subject</label>
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                        >
                          <option value="">Select subject…</option>
                          {academicSubjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Parent-Specific Child Linkage Fields */}
                {newUserRole === 'Parent' && (
                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Linked Children (Portal Access)</div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px' }}>Relationship</label>
                      <select
                        value={parentRelationship}
                        onChange={(e) => setParentRelationship(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                      >
                        <option value="Parent">Parent</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '4px' }}>
                        Select Enrolled Children:
                      </label>
                      {availableStudents.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>No students enrolled in this center yet.</div>
                      ) : (
                        <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 8px', background: '#FFFFFF' }}>
                          {availableStudents.map((st) => (
                            <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={selectedChildIds.includes(st.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedChildIds((prev) => [...prev, st.id]);
                                  else setSelectedChildIds((prev) => prev.filter((id) => id !== st.id));
                                }}
                              />
                              <span>{st.name || `${st.firstName} ${st.lastName}`} ({st.class || 'Class 10'})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Provisioning…' : 'Create & Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Password & Account Created Confirmation Modal */}
      {credentialModal && (
        <div className="modal-backdrop" onClick={() => setCredentialModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', width: '90%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#10B981" />
                <h2 className="modal-title">{credentialModal.title}</h2>
              </div>
              <button onClick={() => setCredentialModal(null)}><X size={18} color="#64748B" /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                The account for <strong>{credentialModal.name}</strong> ({credentialModal.role}) has been successfully provisioned.
              </div>

              {credentialModal.temporaryPassword ? (
                <div style={{ background: '#F1F5F9', border: '1px dashed #CBD5E1', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Temporary Sign-In Password
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <code style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', flex: 1, letterSpacing: '0.5px' }}>
                      {credentialModal.temporaryPassword}
                    </code>
                    <button className="btn btn-primary btn-sm" onClick={handleCopyPassword} style={{ minWidth: '70px' }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
                    Share this one-time password with the user. They can immediately log in at the portal with their email: <strong>{credentialModal.email}</strong>.
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12.5px', color: '#334155' }}>
                  This user already had an existing account in Better Auth. They can sign in immediately using their existing password.
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setCredentialModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

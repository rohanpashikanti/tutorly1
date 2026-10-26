import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Users,
  UserCheck,
  Lock,
  Eye,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  Layers,
  BookOpen,
  Download,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV } from '../../utils/demoActions';
import { getStoredUsers, saveStoredUsers } from '../../utils/storage';
import { User } from '../../types';
import { api } from '../../api/client';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Admin' | 'Teacher' | 'Parent' | 'Staff';
  assigned: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
}

const INITIAL_USERS: UserRecord[] = [
  {
    id: 'u-1',
    name: 'Rohan Pashikanti',
    email: 'rohan@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Admin',
    assigned: 'All Center Operations',
    status: 'Active',
    lastActive: 'Today, 10:30 AM'
  },
  {
    id: 'u-2',
    name: 'Priya Sharma',
    email: 'priya@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'Teacher',
    assigned: 'Class 10 - A, 9 - B',
    status: 'Active',
    lastActive: 'Today, 09:15 AM'
  },
  {
    id: 'u-3',
    name: 'Vikram Reddy',
    email: 'vikram@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'Teacher',
    assigned: 'Class 8 - A, 8 - B',
    status: 'Active',
    lastActive: 'Yesterday, 06:20 PM'
  },
  {
    id: 'u-4',
    name: 'Neha Gupta',
    email: 'neha@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'Teacher',
    assigned: 'Class 9 - A',
    status: 'Active',
    lastActive: 'Today, 08:45 AM'
  },
  {
    id: 'u-5',
    name: 'Suresh Kumar',
    email: 'suresh@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'Parent',
    assigned: 'Aditya Sharma (Class 10 - A)',
    status: 'Active',
    lastActive: 'Today, 07:10 AM'
  },
  {
    id: 'u-6',
    name: 'Divya Reddy',
    email: 'divya@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'Parent',
    assigned: 'Kavya Sharma (Class 9 - A)',
    status: 'Active',
    lastActive: 'Yesterday, 09:30 PM'
  },
  {
    id: 'u-7',
    name: 'Arun Patel',
    email: 'arun@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    role: 'Staff',
    assigned: 'Administrative Coordinator',
    status: 'Active',
    lastActive: 'Today, 11:00 AM'
  },
  {
    id: 'u-8',
    name: 'Meena Iyer',
    email: 'meena@tutorly.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Staff',
    assigned: 'Front Desk / Attendance',
    status: 'Inactive',
    lastActive: '12 Oct 2026, 02:15 PM'
  }
];

export const UserManagementPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [activeTab, setActiveTab] = useState<string>('All Users');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);
  const [isPermissionsMatrixOpen, setIsPermissionsMatrixOpen] = useState<boolean>(false);
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('Admin');

  // Form state
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Teacher' | 'Parent' | 'Staff'>('Teacher');
  const [newUserAssigned, setNewUserAssigned] = useState<string>('Class 10 - A');

  const refreshUsers = async () => {
    try {
      const res = await api.users.list(activeInstitutionId);
      if (res && res.users && res.users.length > 0) {
        setUsers(res.users);
      }
    } catch {
      // Keep cached state
    }
  };

  useEffect(() => {
    refreshUsers();
  }, [activeInstitutionId]);

  // Combined search and filtering logic
  const filteredUsers = users.filter((u) => {
    const matchesTab =
      activeTab === 'All Users' ||
      (activeTab === 'Admins' && u.role === 'Admin') ||
      (activeTab === 'Teachers' && u.role === 'Teacher') ||
      (activeTab === 'Parents' && u.role === 'Parent') ||
      (activeTab === 'Staff' && u.role === 'Staff');
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.assigned.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'All' || u.status === statusFilter;
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    try {
      await api.users.create(activeInstitutionId, {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole.toLowerCase()
      });
      await refreshUsers();
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      showToast(`User ${newUserName.trim()} added successfully!`, 'success');
      return;
    } catch (err: any) {
      showToast(err.message || 'Failed to add user', 'error');
    }
  };

  const handleExportUsers = () => {
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Assigned Scope', 'Status', 'Last Active'];
    const rows = filteredUsers.map((u) => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.assigned,
      u.status,
      u.lastActive
    ]);
    downloadCSV(`Users_List_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    showToast(`Exported ${filteredUsers.length} users to CSV`, 'success');
  };

  const toggleUserStatus = async (id: string) => {
    const target = users.find(u => u.id === id);
    const newStatus = target?.status === 'Active' ? 'inactive' : 'active';
    try {
      await api.users.updateStatus(activeInstitutionId, id, newStatus);
      await refreshUsers();
      showToast('User status updated in D1', 'info');
      return;
    } catch {
      // Local fallback
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u
      )
    );
    showToast('User status updated', 'info');
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
          <p>Manage all tuition center administrators, faculty members, parents, and role authorizations.</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportUsers}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddUserOpen(true)}>
            <Plus size={16} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 5 Metric Cards */}
      <div className="stat-grid-5" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon purple">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-footer"><span className="stat-subtext">All active roles</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <UserCheck size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Teachers</div>
            <div className="stat-value">{users.filter(u => u.role === 'Teacher').length}</div>
            <div className="stat-footer"><span className="stat-badge-change positive">Teaching Faculty</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <ShieldCheck size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Admins</div>
            <div className="stat-value">{users.filter(u => u.role === 'Admin').length}</div>
            <div className="stat-footer"><span className="stat-subtext">Center Managers</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Users size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Parents</div>
            <div className="stat-value">{users.filter(u => u.role === 'Parent').length}</div>
            <div className="stat-footer"><span className="stat-badge-change positive">Enrolled Guardians</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Layers size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Staff / Support</div>
            <div className="stat-value">{users.filter(u => u.role === 'Staff').length}</div>
            <div className="stat-footer"><span className="stat-subtext">Operational staff</span></div>
          </div>
        </div>
      </div>

      {/* Filter Bar with Perfectly Aligned Search and Select */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          {/* Role Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {['All Users', 'Admins', 'Teachers', 'Parents', 'Staff'].map((tab) => (
              <button
                key={tab}
                className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box and Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  height: '36px'
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
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Users Table (70%) + Right Role Permissions & Activity (30%) */}
      <div className="grid-split-sidebar">
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
                  <th>User</th>
                  <th>Role</th>
                  <th>Assigned Scope</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                      No users match "{searchQuery}" under {activeTab} ({statusFilter} status).
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
                            <div className="user-table-name">{u.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          u.role === 'Admin' ? 'badge-purple' :
                          u.role === 'Teacher' ? 'badge-info' :
                          u.role === 'Parent' ? 'badge-success' : 'badge-neutral'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ color: '#475569', fontSize: '12.5px' }}>{u.assigned}</td>
                      <td>
                        <span className={`badge ${u.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{u.lastActive}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => toggleUserStatus(u.id)}
                        >
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Roles & Audit Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Roles & Permissions Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Roles & Access</h3>
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { role: 'Admin', count: '3 users', desc: 'Full institutional control', color: '#8B5CF6' },
                { role: 'Teacher', count: '8 users', desc: 'Attendance, tests & grades', color: '#3B82F6' },
                { role: 'Parent', count: '12 users', desc: 'Child reports, attendance & fees', color: '#10B981' },
                { role: 'Staff', count: '5 users', desc: 'Front-desk operations', color: '#F59E0B' }
              ].map((r, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{r.role}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{r.desc}</div>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent User Activity */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Activity Stream</h3>
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>Priya Sharma</div>
                <div style={{ color: '#64748B' }}>Submitted attendance for Class 10 (Batch A)</div>
                <div style={{ color: '#94A3B8', fontSize: '10.5px', marginTop: '2px' }}>10 mins ago</div>
              </div>
              <div style={{ paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>Vikram Reddy</div>
                <div style={{ color: '#64748B' }}>Saved Physics test marks for Batch B</div>
                <div style={{ color: '#94A3B8', fontSize: '10.5px', marginTop: '2px' }}>45 mins ago</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>Rohan Pashikanti</div>
                <div style={{ color: '#64748B' }}>Updated institution settings</div>
                <div style={{ color: '#94A3B8', fontSize: '10.5px', marginTop: '2px' }}>2 hours ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddUserOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Add New User</h2>
              <button onClick={() => setIsAddUserOpen(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleAddUser}>
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
                    placeholder="user@tutorly.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      System Role
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Admin">Administrator</option>
                      <option value="Teacher">Teacher / Faculty</option>
                      <option value="Parent">Parent</option>
                      <option value="Staff">Operational Staff</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Assigned Scope
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Class 10 - A"
                      value={newUserAssigned}
                      onChange={(e) => setNewUserAssigned(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

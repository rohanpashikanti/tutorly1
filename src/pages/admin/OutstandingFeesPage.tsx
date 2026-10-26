import React, { useState } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Send,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  DollarSign,
  X,
  MessageSquare,
  Mail,
  Smartphone,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';

interface OutstandingRecord {
  id: string;
  studentId: string;
  studentName: string;
  avatar: string;
  class: string;
  feePlan: string;
  totalFees: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
  status: 'Overdue' | 'Pending';
  parentName: string;
  phone: string;
}

const OUTSTANDING_STUDENTS: OutstandingRecord[] = [
  {
    id: 'out-1',
    studentId: 'stu-003',
    studentName: 'Charan Kumar',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Tuition Monthly',
    totalFees: 3000,
    paid: 0,
    outstanding: 3000,
    dueDate: '10 Oct 2026',
    daysOverdue: 21,
    status: 'Overdue',
    parentName: 'Ramesh Kumar',
    phone: '+91 98765 11223'
  },
  {
    id: 'out-2',
    studentId: 'stu-005',
    studentName: 'Divya Nair',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - A',
    feePlan: 'Tuition Monthly',
    totalFees: 2500,
    paid: 0,
    outstanding: 2500,
    dueDate: '12 Oct 2026',
    daysOverdue: 19,
    status: 'Overdue',
    parentName: 'Gopal Nair',
    phone: '+91 98765 22334'
  },
  {
    id: 'out-3',
    studentId: 'stu-006',
    studentName: 'Harshith Reddy',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - A',
    feePlan: 'Tuition Monthly',
    totalFees: 2500,
    paid: 500,
    outstanding: 2000,
    dueDate: '15 Oct 2026',
    daysOverdue: 16,
    status: 'Overdue',
    parentName: 'Venkat Reddy',
    phone: '+91 98765 33445'
  },
  {
    id: 'out-4',
    studentId: 'stu-007',
    studentName: 'Nithya Sree',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    class: 'Class 8 - B',
    feePlan: 'Tuition Monthly',
    totalFees: 2500,
    paid: 0,
    outstanding: 2500,
    dueDate: '18 Oct 2026',
    daysOverdue: 13,
    status: 'Overdue',
    parentName: 'Srinivas Rao',
    phone: '+91 98765 44556'
  },
  {
    id: 'out-5',
    studentId: 'stu-008',
    studentName: 'Manish Verma',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - B',
    feePlan: 'Tuition Monthly',
    totalFees: 2500,
    paid: 0,
    outstanding: 2500,
    dueDate: '20 Oct 2026',
    daysOverdue: 11,
    status: 'Overdue',
    parentName: 'Deepak Verma',
    phone: '+91 98765 55667'
  },
  {
    id: 'out-6',
    studentId: 'stu-004',
    studentName: 'Kavya Sri',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Science Batch',
    totalFees: 1500,
    paid: 0,
    outstanding: 1500,
    dueDate: '22 Oct 2026',
    daysOverdue: 9,
    status: 'Overdue',
    parentName: 'Anil Sri',
    phone: '+91 98765 66778'
  },
  {
    id: 'out-7',
    studentId: 'stu-009',
    studentName: 'Bhavana Reddy',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Maths Advanced',
    totalFees: 1500,
    paid: 0,
    outstanding: 1500,
    dueDate: '25 Oct 2026',
    daysOverdue: 6,
    status: 'Pending',
    parentName: 'Rajesh Reddy',
    phone: '+91 98765 77889'
  },
  {
    id: 'out-8',
    studentId: 'stu-001',
    studentName: 'Aditya Sharma',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Tuition Monthly',
    totalFees: 3000,
    paid: 1000,
    outstanding: 2000,
    dueDate: '28 Oct 2026',
    daysOverdue: 3,
    status: 'Pending',
    parentName: 'Priya Sharma',
    phone: '+91 98765 43210'
  }
];

export const OutstandingFeesPage: React.FC = () => {
  const { navigateTo, showToast } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
  const [selectedFeePlan, setSelectedFeePlan] = useState<string>('All Fee Plans');
  const [statusFilter, setStatusFilter] = useState<string>('Unpaid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [activeStudentModal, setActiveStudentModal] = useState<OutstandingRecord | null>(null);

  const filteredRecords = OUTSTANDING_STUDENTS.filter((item) => {
    const matchesClass = selectedClass === 'All Classes' || item.class.includes(selectedClass);
    const matchesPlan = selectedFeePlan === 'All Fee Plans' || item.feePlan === selectedFeePlan;
    const matchesStatus =
      statusFilter === 'Unpaid' ||
      (statusFilter === 'Overdue' && item.status === 'Overdue') ||
      (statusFilter === 'Pending' && item.status === 'Pending');
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.parentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesPlan && matchesStatus && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredRecords.map((r) => r.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const data = filteredRecords.map((r) => ({
      StudentName: r.studentName,
      Class: r.class,
      FeePlan: r.feePlan,
      TotalFees: r.totalFees,
      PaidAmount: r.paid,
      OutstandingAmount: r.outstanding,
      DueDate: r.dueDate,
      DaysOverdue: r.daysOverdue,
      Status: r.status,
      ParentName: r.parentName,
      Phone: r.phone,
    }));
    downloadCSV('Outstanding_Fees_Report.csv', data);
    showToast(`Exported ${data.length} outstanding dues records to CSV`, 'success');
  };

  const handleSendBatchReminders = () => {
    const count = selectedStudents.length > 0 ? selectedStudents.length : filteredRecords.length;
    showToast(`[Demo Mode] Simulated payment reminder dispatched to ${count} parents via ${reminderChannel.toUpperCase()}. Live SMS/WhatsApp gateway integration required.`, 'info');
    setIsReminderModalOpen(false);
    setSelectedStudents([]);
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Fees & Payments</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Outstanding Fees</span>
          </div>
          <h1>Outstanding Fees</h1>
          <p className="page-subtitle">
            View and manage unpaid fees, track dues, and send reminders to parents.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsReminderModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={16} />
            <span>Send Reminders</span>
          </button>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Class
            </label>
            <select
              className="form-control"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="All Classes">All Classes</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 8">Class 8</option>
            </select>
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Batch
            </label>
            <select
              className="form-control"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <option value="All Batches">All Batches</option>
              <option value="Batch A">Batch A (Morning)</option>
              <option value="Batch B">Batch B (Evening)</option>
            </select>
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Fee Plan
            </label>
            <select
              className="form-control"
              value={selectedFeePlan}
              onChange={(e) => setSelectedFeePlan(e.target.value)}
            >
              <option value="All Fee Plans">All Fee Plans</option>
              <option value="Tuition Monthly">Tuition Monthly</option>
              <option value="Science Batch">Science Batch</option>
              <option value="Maths Advanced">Maths Advanced</option>
            </select>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Status
            </label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Unpaid">All Unpaid</option>
              <option value="Overdue">Overdue Only</option>
              <option value="Pending">Pending Only</option>
            </select>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              As of Date
            </label>
            <input type="text" className="form-control" defaultValue="01 Oct 2026" readOnly />
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Outstanding</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹41,500</div>
          <div className="stat-card-trend trend-down" style={{ color: '#EF4444' }}>
            <span>↑ 12% vs last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Students with Dues</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">24</div>
          <div className="stat-card-subtext">34% of total students</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Overdue Amount</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹26,000</div>
          <div className="stat-card-subtext">63% of total dues</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Average Days Overdue</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="stat-card-value">18 days</div>
          <div className="stat-card-trend trend-down" style={{ color: '#EF4444' }}>
            <span>↑ 6 days vs last month</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left Table (70%), Right Panels (30%) */}
      <div className="grid-split-sidebar">
        {/* Outstanding Table Card */}
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color="#6366F1" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Outstanding Fees ({filteredRecords.length})
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="search-box" style={{ width: '220px' }}>
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '13px' }}>
                <Filter size={14} />
                <span>Filter</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '13px' }}
                onClick={handleExportCSV}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === filteredRecords.length && filteredRecords.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Fee Plan</th>
                  <th>Total Fees</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(item.id)}
                        onChange={() => toggleSelectOne(item.id)}
                      />
                    </td>
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                        onClick={() => navigateTo('student-profile', { studentId: item.studentId })}
                      >
                        <img
                          src={item.avatar}
                          alt={item.studentName}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                            {item.studentName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            Parent: {item.parentName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{item.class}</span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#334155' }}>{item.feePlan}</td>
                    <td style={{ fontWeight: 600 }}>₹{item.totalFees.toLocaleString()}</td>
                    <td style={{ color: '#10B981', fontWeight: 600 }}>₹{item.paid.toLocaleString()}</td>
                    <td style={{ color: '#EF4444', fontWeight: 700 }}>₹{item.outstanding.toLocaleString()}</td>
                    <td style={{ fontSize: '12px', color: '#64748B' }}>{item.dueDate}</td>
                    <td>
                      <span
                        style={{
                          color: item.daysOverdue > 10 ? '#EF4444' : '#F59E0B',
                          fontWeight: 600,
                          fontSize: '12px'
                        }}
                      >
                        {item.daysOverdue} days
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${item.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          className="btn-icon"
                          title="View Details"
                          onClick={() => setActiveStudentModal(item)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Send Reminder"
                          onClick={() => {
                            showToast(`Payment reminder dispatched to ${item.parentName} (${item.phone})`, 'success');
                          }}
                        >
                          <Send size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: '#64748B'
            }}
          >
            <div>Showing 1-{filteredRecords.length} of 24 students</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-primary" style={{ padding: '4px 10px', minWidth: '32px' }}>
                1
              </button>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', minWidth: '32px' }}>
                2
              </button>
              <button className="btn btn-secondary" style={{ padding: '4px 10px', minWidth: '32px' }}>
                3
              </button>
              <button className="btn btn-secondary" style={{ padding: '4px 8px' }}>
                <ChevronRight size={16} />
              </button>
              <span style={{ marginLeft: '12px' }}>Rows per page: 8</span>
            </div>
          </div>
        </div>

        {/* Right Side Column: Aging Breakdown, Donut Chart & Reminders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Outstanding by Age */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Clock size={16} color="#6366F1" />
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Outstanding by Age</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', paddingBottom: '8px' }}>
              {[
                { label: '0-15 days', amount: '₹12,000', height: 100, color: '#A5B4FC' },
                { label: '16-30 days', amount: '₹10,500', height: 85, color: '#FDE68A' },
                { label: '31-60 days', amount: '₹8,000', height: 65, color: '#FBCFE8' },
                { label: '61-90 days', amount: '₹7,000', height: 55, color: '#FCA5A5' },
                { label: '> 90 days', amount: '₹4,000', height: 35, color: '#EF4444' }
              ].map((b, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>{b.amount}</span>
                  <div
                    style={{
                      width: '32px',
                      height: `${b.height}px`,
                      backgroundColor: b.color,
                      borderRadius: '6px 6px 0 0'
                    }}
                  />
                  <span style={{ fontSize: '9.5px', color: '#64748B', whiteSpace: 'nowrap' }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outstanding by Class */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CreditCard size={16} color="#6366F1" />
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Outstanding by Class</h3>
            </div>

            <DonutChart
              size={170}
              strokeWidth={20}
              centerLabel="Total Outstanding"
              centerValue="₹41,500"
              segments={[
                { label: 'Class 10 - A', value: 36, color: '#6366F1' },
                { label: 'Class 9 - A', value: 28, color: '#38BDF8' },
                { label: 'Class 8 - B', value: 18, color: '#F43F5E' },
                { label: 'Class 9 - B', value: 12, color: '#FB923C' },
                { label: 'Others', value: 6, color: '#A855F7' }
              ]}
            />
          </div>

          {/* Recent Reminders */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Recent Reminders</h3>
              </div>
              <button
                className="btn-link"
                style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => showToast('Opening notification log...', 'info')}
              >
                View All →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#EEF2FF', color: '#6366F1' }}>
                  <Mail size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                    Payment Reminder Sent
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Class 10 - A (5 students)
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Today, 10:24 AM
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#10B981' }}>
                  <MessageSquare size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                    Payment Reminder Sent
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Class 9 - A (4 students)
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Today, 09:15 AM
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
                  <Clock size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                    Overdue Notice Sent
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Class 9 - B (3 students)
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                    Yesterday, 05:30 PM
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Send Reminders Modal */}
      {isReminderModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Dispatch Fee Reminders</h3>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Send automated notices to parents with pending or overdue balances.
                  </div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsReminderModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Target Recipients
                </label>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                  {selectedStudents.length > 0 ? (
                    <span style={{ fontWeight: 600, color: '#6366F1' }}>
                      {selectedStudents.length} selected students
                    </span>
                  ) : (
                    <span>All 24 students with outstanding dues (₹41,500 total)</span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Communication Channel
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${reminderChannel === 'whatsapp' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setReminderChannel('whatsapp')}
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', alignItems: 'center' }}
                  >
                    <MessageSquare size={18} />
                    <span style={{ fontSize: '12px' }}>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    className={`btn ${reminderChannel === 'sms' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setReminderChannel('sms')}
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', alignItems: 'center' }}
                  >
                    <Smartphone size={18} />
                    <span style={{ fontSize: '12px' }}>SMS</span>
                  </button>

                  <button
                    type="button"
                    className={`btn ${reminderChannel === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setReminderChannel('email')}
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', alignItems: 'center' }}
                  >
                    <Mail size={18} />
                    <span style={{ fontSize: '12px' }}>Email</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Message Preview
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  style={{ fontSize: '12px', lineHeight: 1.5 }}
                  defaultValue={`Dear Parent, This is a gentle reminder from Sri Sai Tuition Center that fee dues of {AMOUNT} for your ward {STUDENT_NAME} ({CLASS}) were due on {DUE_DATE}. Kindly clear the pending balance at your earliest convenience.`}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setIsReminderModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSendBatchReminders}>
                Send Reminders Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Due Details Modal */}
      {activeStudentModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={activeStudentModal.avatar}
                  alt={activeStudentModal.studentName}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{activeStudentModal.studentName}</h3>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {activeStudentModal.class} | Due: {activeStudentModal.dueDate}
                  </div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setActiveStudentModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Fee Plan</div>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>{activeStudentModal.feePlan}</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Days Overdue</div>
                  <div style={{ fontWeight: 700, color: '#EF4444', marginTop: '2px' }}>{activeStudentModal.daysOverdue} days</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Total Fees</div>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>₹{activeStudentModal.totalFees.toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#FEE2E2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#EF4444' }}>Outstanding Balance</div>
                  <div style={{ fontWeight: 700, color: '#EF4444', marginTop: '2px' }}>₹{activeStudentModal.outstanding.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Parent Contact</div>
                <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                  {activeStudentModal.parentName} ({activeStudentModal.phone})
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  showToast(`[Demo Mode] Simulated reminder dispatched to ${activeStudentModal.parentName} (${activeStudentModal.phone}). Live gateway integration required.`, 'info');
                  setActiveStudentModal(null);
                }}
              >
                Send Reminder
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActiveStudentModal(null);
                  navigateTo('fee-collection');
                }}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

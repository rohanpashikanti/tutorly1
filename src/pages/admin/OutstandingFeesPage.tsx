import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Send,
  AlertCircle,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  X,
  MessageSquare,
  Mail,
  Smartphone,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';

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

export const OutstandingFeesPage: React.FC = () => {
  const { navigateTo, showToast, activeInstitutionId, institutionName } = useApp();
  const [records, setRecords] = useState<OutstandingRecord[]>([]);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [batchesList, setBatchesList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
  const [selectedFeePlan, setSelectedFeePlan] = useState<string>('All Fee Plans');
  const [statusFilter, setStatusFilter] = useState<string>('Unpaid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [activeStudentModal, setActiveStudentModal] = useState<OutstandingRecord | null>(null);

  const loadData = async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [feeRes, overRes] = await Promise.all([
        api.fees.getRecords(activeInstitutionId),
        api.academics.getOverview(activeInstitutionId).catch(() => null)
      ]);
      const rawRecords = feeRes.records || [];
      const outstandingItems: OutstandingRecord[] = rawRecords
        .filter((r) => r.totalFees > r.paidAmount)
        .map((r) => {
          const outstanding = Math.max(0, r.totalFees - r.paidAmount);
          const daysOverdue = r.daysOverdue || 0;
          return {
            id: r.id,
            studentId: r.id,
            studentName: r.studentName,
            avatar: r.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            class: r.class || 'Unassigned',
            feePlan: r.feePlan || 'Tuition Fee',
            totalFees: r.totalFees,
            paid: r.paidAmount,
            outstanding,
            dueDate: r.dueDate || '—',
            daysOverdue,
            status: daysOverdue > 0 ? 'Overdue' : 'Pending',
            parentName: r.parentName || 'Parent',
            phone: r.phone || ''
          };
        });

      setRecords(outstandingItems);
      setClassesList(overRes?.classes || []);
      setBatchesList(overRes?.batches || []);
    } catch (err: any) {
      console.error('Failed to load outstanding fees:', err);
      setLoadError(err?.message || 'Failed to load fee records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeInstitutionId]);

  const filteredRecords = records.filter((item) => {
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

  const totalOutstanding = records.reduce((sum, r) => sum + r.outstanding, 0);
  const studentsWithDues = records.length;
  const overdueRecords = records.filter(r => r.status === 'Overdue');
  const overdueAmount = overdueRecords.reduce((sum, r) => sum + r.outstanding, 0);
  const avgDaysOverdue = overdueRecords.length > 0 ? Math.round(overdueRecords.reduce((sum, r) => sum + r.daysOverdue, 0) / overdueRecords.length) : 0;

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
            disabled={records.length === 0}
          >
            <Send size={16} />
            <span>Send Reminders</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

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
              {classesList.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
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
              {batchesList.map((b) => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
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
          <div className="stat-card-value">₹{totalOutstanding.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">{totalOutstanding > 0 ? 'Cumulative dues' : 'No outstanding dues'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Students with Dues</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{studentsWithDues}</div>
          <div className="stat-card-subtext">{studentsWithDues > 0 ? 'Pending payments' : 'All students cleared'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Overdue Amount</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{overdueAmount.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">{overdueAmount > 0 ? 'Past scheduled due dates' : 'No overdue accounts'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Average Days Overdue</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="stat-card-value">{avgDaysOverdue} days</div>
          <div className="stat-card-subtext">{avgDaysOverdue > 0 ? 'Average delay' : 'No overdue accounts'}</div>
        </div>
      </div>

      {/* Main Content Layout */}
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
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                      <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                        No outstanding dues
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        All students are fully cleared or no fee charges have been assigned yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item, idx) => (
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
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => setActiveStudentModal(item)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Outstanding by Class */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CreditCard size={16} color="#6366F1" />
              <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Outstanding Dues</h3>
            </div>

            <DonutChart
              size={170}
              strokeWidth={20}
              centerLabel="Total Dues"
              centerValue={`₹${totalOutstanding.toLocaleString('en-IN')}`}
              segments={
                totalOutstanding > 0
                  ? [{ label: 'Pending Dues', value: totalOutstanding, color: '#EF4444' }]
                  : [{ label: 'All Cleared', value: 1, color: '#E2E8F0' }]
              }
            />
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
                    Send notices to parents with pending or overdue balances.
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
                    <span>All {records.length} students with outstanding dues (₹{totalOutstanding.toLocaleString('en-IN')} total)</span>
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
                  defaultValue={`Dear Parent, This is a gentle reminder from ${institutionName || 'Tutorly'} that fee dues of {AMOUNT} for your ward {STUDENT_NAME} ({CLASS}) were due on {DUE_DATE}. Kindly clear the pending balance at your earliest convenience.`}
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
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{activeStudentModal.studentName}</h3>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  {activeStudentModal.class} | Due: {activeStudentModal.dueDate}
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

              {activeStudentModal.phone && (
                <div style={{ padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Parent Contact</div>
                  <div style={{ fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
                    {activeStudentModal.parentName} ({activeStudentModal.phone})
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  showToast(`Simulated reminder dispatched to ${activeStudentModal.parentName}`, 'info');
                  setActiveStudentModal(null);
                }}
              >
                Send Reminder
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActiveStudentModal(null);
                  navigateTo('student-fees');
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

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  AlertCircle,
  Clock,
  X,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FeeRecord, Student } from '../../types';
import { DonutChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';
import {
  getStoredStudentFees,
  saveStoredStudentFees,
  getStoredStudents,
  saveStoredStudents
} from '../../utils/storage';

export const FeeCollectionPage: React.FC = () => {
  const { showToast, navigateTo, activeInstitutionId } = useApp();
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => getStoredStudentFees());
  const [students, setStudents] = useState<Student[]>(() => getStoredStudents());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedStatus, setSelectedStatus] = useState('All Payments');
  const [showCollectModal, setShowCollectModal] = useState(false);

  // Collect Fee form state
  const [collectForm, setCollectForm] = useState({
    studentId: '',
    feePlan: 'Tuition Monthly Fee',
    amount: 3000,
    paymentMethod: 'UPI' as 'UPI' | 'Cash' | 'Card' | 'Bank Transfer',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const loadFees = useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [feeRes, stuRes] = await Promise.all([
        api.fees.getRecords(activeInstitutionId),
        api.students.list(activeInstitutionId).catch(() => ({ students: [] as Student[], total: 0 }))
      ]);
      const records = feeRes.records || [];
      setFeeRecords(records);
      saveStoredStudentFees(records);

      if (stuRes && stuRes.students) {
        setStudents(stuRes.students);
        saveStoredStudents(stuRes.students);
        if (stuRes.students.length > 0 && !collectForm.studentId) {
          setCollectForm((prev) => ({ ...prev, studentId: stuRes.students[0].id }));
        }
      }
    } catch (err) {
      console.error('Error fetching fees:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load fee records');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId, collectForm.studentId]);

  useEffect(() => {
    void loadFees();
  }, [loadFees]);

  const handleExportCSV = () => {
    const data = filteredRecords.map((r) => ({
      StudentName: r.studentName,
      Class: r.class,
      FeePlan: r.feePlan,
      TotalFees: r.totalFees,
      PaidAmount: r.paidAmount,
      OutstandingAmount: r.outstandingAmount,
      DueDate: r.dueDate,
      PaymentDate: r.paymentDate || '—',
      Method: r.paymentMethod || '—',
      TransactionId: r.transactionId || '—',
      ReceiptNo: r.receiptNo || '—',
      Status: r.status,
    }));
    downloadCSV('Fee_Collection_Records.csv', data);
    showToast(`Exported ${data.length} fee records to CSV`, 'success');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === collectForm.studentId);
    if (!student && students.length > 0) {
      showToast('Please select a student', 'error');
      return;
    }

    try {
      if (activeInstitutionId && student) {
        await api.fees.recordPayment(activeInstitutionId, {
          studentId: student.id,
          amount: collectForm.amount,
          method: collectForm.paymentMethod,
          notes: collectForm.remarks || undefined,
        });
        showToast(
          `Payment of ₹${collectForm.amount} recorded for ${student.name} via ${collectForm.paymentMethod}.`,
          'success'
        );
        setShowCollectModal(false);
        await loadFees();
      } else {
        setShowCollectModal(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record payment', 'error');
    }
  };

  const filteredRecords = feeRecords.filter((rec) => {
    const matchesSearch = rec.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'All Classes' || rec.class.includes(selectedClass);
    const matchesStatus = selectedStatus === 'All Payments' || rec.status === selectedStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  // Dynamic calculations from real records
  const totalCollected = feeRecords
    .filter((r) => r.status === 'Paid')
    .reduce((acc, r) => acc + (r.paidAmount || r.totalFees || 0), 0);

  const pendingAmount = feeRecords
    .filter((r) => r.status === 'Pending')
    .reduce((acc, r) => acc + (r.outstandingAmount ?? (r.totalFees - (r.paidAmount || 0))), 0);

  const overdueAmount = feeRecords
    .filter((r) => r.status === 'Overdue')
    .reduce((acc, r) => acc + (r.outstandingAmount ?? (r.totalFees - (r.paidAmount || 0))), 0);

  const pendingCount = feeRecords.filter((r) => r.status === 'Pending').length;
  const overdueCount = feeRecords.filter((r) => r.status === 'Overdue').length;
  const totalBilled = totalCollected + pendingAmount + overdueAmount;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;

  // Real method breakdown
  const paidRecords = feeRecords.filter((r) => r.status === 'Paid' && r.paymentMethod);
  const methodCounts: Record<string, number> = {};
  paidRecords.forEach((r) => {
    const m = r.paymentMethod || 'Other';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  });

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Fees & Payments</span>
            <span>›</span>
            <span>Fee Collection</span>
          </div>
          <h1>Fee Collection</h1>
          <p>Collect student fees, track payments, manage dues and generate receipts.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigateTo('payment-history')}>
            <FileText size={15} />
            <span>Receipts</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowCollectModal(true)}>
            <Plus size={16} />
            <span>Collect Fee</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadFees()}>Retry</button>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="filter-bar">
        <div className="filter-controls">
          <div className="search-field" style={{ minWidth: '220px' }}>
            <Search size={14} className="field-icon" />
            <input
              type="text"
              placeholder="Search by name, roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="select-field" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option>All Classes</option>
              <option>Class 10</option>
              <option>Class 9</option>
              <option>Class 8</option>
            </select>
          </div>

          <div>
            <select className="select-field" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option>All Payments</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Overdue</option>
            </select>
          </div>
        </div>

        <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon green"><DollarSign size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Collected</div>
            <div className="stat-value">{isLoading ? '—' : `₹${totalCollected.toLocaleString('en-IN')}`}</div>
            <div className="stat-footer"><span className="stat-subtext">Realized collections</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><Clock size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Pending Amount</div>
            <div className="stat-value">{isLoading ? '—' : `₹${pendingAmount.toLocaleString('en-IN')}`}</div>
            <div className="stat-footer"><span className="stat-subtext">{pendingCount} student{pendingCount === 1 ? '' : 's'}</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><AlertCircle size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Overdue Amount</div>
            <div className="stat-value">{isLoading ? '—' : `₹${overdueAmount.toLocaleString('en-IN')}`}</div>
            <div className="stat-footer"><span className="stat-subtext">{overdueCount} student{overdueCount === 1 ? '' : 's'}</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Collection Rate</div>
            <div className="stat-value">{isLoading ? '—' : `${collectionRate}%`}</div>
            <div className="stat-footer"><span className="stat-subtext">Of billed tuition</span></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Collection Table + Right Breakdown & Recent */}
      <div className="grid-split">
        
        {/* Table Column */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Student Fee Collection ({filteredRecords.length})</div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" /></th>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Fee Plan</th>
                  <th>Amount</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                      <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                        No fee records found
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {feeRecords.length === 0
                          ? 'No fee records have been assigned or recorded yet.'
                          : 'No fee records match the current filter.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => (
                    <tr key={rec.id}>
                      <td><input type="checkbox" /></td>
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                      <td>
                        <div className="user-table-cell">
                          <img src={rec.avatar} alt={rec.studentName} className="user-table-avatar" />
                          <span className="user-table-name">{rec.studentName}</span>
                        </div>
                      </td>
                      <td>{rec.class}</td>
                      <td>{rec.feePlan}</td>
                      <td><strong>₹{rec.totalFees.toLocaleString('en-IN')}</strong></td>
                      <td style={{ color: '#64748B', fontSize: '12.5px' }}>{rec.paymentDate || '—'}</td>
                      <td>
                        {rec.paymentMethod ? (
                          <span className="badge badge-purple">{rec.paymentMethod}</span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${rec.status === 'Paid' ? 'badge-success' : rec.status === 'Pending' ? 'badge-warning' : 'badge-danger'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        {rec.status === 'Paid' ? (
                          <button
                            onClick={() => navigateTo('payment-history')}
                            style={{ padding: '4px', color: '#6366F1' }}
                            title="View Receipt"
                          >
                            <FileText size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setCollectForm({ ...collectForm, studentId: rec.studentId, amount: rec.totalFees });
                              setShowCollectModal(true);
                            }}
                            className="btn btn-sm btn-outline"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            Collect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Collection Overview Donut */}
          <div className="card">
            <div className="card-header"><div className="card-title">Collection Overview</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <DonutChart value={collectionRate} size={110} label={`${collectionRate}%`} sublabel="Collection" color="#6366F1" />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Collected</span><strong>₹{totalCollected.toLocaleString('en-IN')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pending</span><strong>₹{pendingAmount.toLocaleString('en-IN')}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Overdue</span><strong style={{ color: '#EF4444' }}>₹{overdueAmount.toLocaleString('en-IN')}</strong></div>
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="card">
            <div className="card-header"><div className="card-title">Payment Methods</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {paidRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94A3B8', fontSize: '12.5px' }}>
                  No payment transactions recorded yet.
                </div>
              ) : (
                ['UPI', 'Cash', 'Card', 'Bank Transfer'].map((m) => {
                  const count = methodCounts[m] || 0;
                  const pct = paidRecords.length > 0 ? Math.round((count / paidRecords.length) * 100) : 0;
                  return (
                    <div key={m}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                        <span>{m}</span><strong>{pct}% ({count})</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '4px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#6366F1', borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Collect Fee Modal */}
      {showCollectModal && (
        <div className="modal-backdrop" onClick={() => setShowCollectModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Fee Payment</h2>
              <button onClick={() => setShowCollectModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '12px', color: '#92400E' }}>
                  ⚠️ <strong>Manual Verification Note:</strong> Recorded Cash, UPI, and Bank Transfer entries represent manual records and are not automatically gateway-cleared.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Student *</label>
                  <select
                    className="select-field"
                    style={{ width: '100%' }}
                    value={collectForm.studentId}
                    onChange={(e) => setCollectForm({ ...collectForm, studentId: e.target.value })}
                  >
                    {students.length === 0 ? (
                      <option value="">No students enrolled</option>
                    ) : (
                      students.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.class} - {s.admissionNo})</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Fee Plan</label>
                    <select
                      className="select-field"
                      style={{ width: '100%' }}
                      value={collectForm.feePlan}
                      onChange={(e) => setCollectForm({ ...collectForm, feePlan: e.target.value })}
                    >
                      <option>Tuition Monthly Fee</option>
                      <option>Special Batch Fee</option>
                      <option>Maths Advanced</option>
                      <option>Entrance Prep Fee</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={collectForm.amount}
                      onChange={(e) => setCollectForm({ ...collectForm, amount: Number(e.target.value) })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Payment Method Pills */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '8px' }}>
                    {(['UPI', 'Cash', 'Card', 'Bank Transfer'] as const).map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={`btn ${collectForm.paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCollectForm({ ...collectForm, paymentMethod: m })}
                        style={{ padding: '8px 4px', fontSize: '12px' }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Reference ID for UPI / Bank Transfer */}
                {(collectForm.paymentMethod === 'UPI' || collectForm.paymentMethod === 'Bank Transfer') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      UTR / Reference Number (Self-reported)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 112345678901"
                      value={collectForm.transactionId}
                      onChange={(e) => setCollectForm({ ...collectForm, transactionId: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Payment Date</label>
                  <input
                    type="date"
                    value={collectForm.paymentDate}
                    onChange={(e) => setCollectForm({ ...collectForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCollectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={students.length === 0}>Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  X,
  Receipt
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FeeRecord } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { exportReportToPDF } from '../../utils/pdfExport';
import { api } from '../../api/client';
import {
  getStoredStudentFees,
  saveStoredStudentFees
} from '../../utils/storage';
import { runConfirmedFeePayment } from '../../utils/feePaymentSubmission';
import { useTrackDirtyForm } from '../../pwa/updateSafety';

export const StudentFeesPage: React.FC = () => {
  const { showToast, activeInstitutionId } = useApp();
  
  // Persistent Fee records state
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => getStoredStudentFees());
  const [feeSummary, setFeeSummary] = useState<{
    totalAssigned: number;
    totalCollected: number;
    totalOutstanding: number;
    fullyPaidCount: number;
    unpaidCount: number;
    partialCount: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Unpaid' | 'Partial'>('All');
  const [classFilter, setClassFilter] = useState('All Classes');
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Record Payment Modal
  const [activePaymentRecord, setActivePaymentRecord] = useState<FeeRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'UPI' as 'UPI' | 'Cash' | 'Card' | 'Bank Transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    externalReference: '',
    remarks: 'Tuition installment received'
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const isPaymentDirty = Boolean(activePaymentRecord) && (
    paymentForm.amount !== '' ||
    paymentForm.externalReference.trim() !== '' ||
    isSubmitting
  );
  useTrackDirtyForm('fee-payment', isPaymentDirty, 'Fee payment submission');

  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshFees = async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [res, over] = await Promise.all([
        api.fees.getRecords(activeInstitutionId),
        api.academics.getOverview(activeInstitutionId).catch(() => null)
      ]);
      const list = res.records || [];
      setFeeRecords(list);
      saveStoredStudentFees(list);
      if (res.summary) {
        setFeeSummary(res.summary);
      }
      setClassesList(over?.classes || []);
    } catch (err) {
      console.error('Failed to load student fees:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load fee records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshFees();
  }, [activeInstitutionId]);

  // Filtered fee records
  const filteredRecords = feeRecords.filter((rec) => {
    const matchesSearch =
      rec.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.receiptNo && rec.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()));

    const remaining = rec.totalFees - rec.paidAmount;
    let matchesStatus = true;
    if (statusFilter === 'Paid') {
      matchesStatus = remaining === 0;
    } else if (statusFilter === 'Unpaid') {
      matchesStatus = rec.paidAmount === 0;
    } else if (statusFilter === 'Partial') {
      matchesStatus = rec.paidAmount > 0 && remaining > 0;
    }

    const matchesClass = classFilter === 'All Classes' || rec.class.includes(classFilter);
    return matchesSearch && matchesStatus && matchesClass;
  });

  // Summary statistics (prefer server-computed tenant aggregates when available)
  const totalAssigned = feeSummary?.totalAssigned ?? feeRecords.reduce((acc, r) => acc + r.totalFees, 0);
  const totalCollected = feeSummary?.totalCollected ?? feeRecords.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalOutstanding = feeSummary?.totalOutstanding ?? (totalAssigned - totalCollected);
  const fullyPaidCount = feeSummary?.fullyPaidCount ?? feeRecords.filter(r => (r.totalFees - r.paidAmount) === 0).length;
  const unpaidCount = feeSummary?.unpaidCount ?? feeRecords.filter(r => r.paidAmount === 0).length;
  const partialCount = feeSummary?.partialCount ?? feeRecords.filter(r => r.paidAmount > 0 && (r.totalFees - r.paidAmount) > 0).length;


  const openPaymentModal = (rec: FeeRecord) => {
    setPaymentIdempotencyKey(crypto.randomUUID());
    setActivePaymentRecord(rec);
    const remaining = rec.totalFees - rec.paidAmount;
    setPaymentError(null);
    setPaymentForm({
      amount: remaining > 0 ? String(remaining) : '0',
      paymentMethod: 'UPI',
      paymentDate: new Date().toISOString().split('T')[0],
      externalReference: '',
      remarks: 'Fee payment received'
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentRecord) return;

    const payAmount = Number(paymentForm.amount);
    const remaining = activePaymentRecord.totalFees - activePaymentRecord.paidAmount;

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (payAmount > remaining) {
      setPaymentError(`Payment amount cannot exceed remaining balance (₹${remaining.toLocaleString('en-IN')}).`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (paymentForm.paymentDate && paymentForm.paymentDate > today) {
      setPaymentError('Payment date cannot be in the future.');
      return;
    }

    if (paymentForm.externalReference && paymentForm.externalReference.trim().length > 100) {
      setPaymentError('External reference must be 100 characters or fewer.');
      return;
    }

    if (isSubmittingRef.current) return;
    if (!paymentIdempotencyKey || !activeInstitutionId) {
      setPaymentError('A payment request could not be started. Close this form and open it again to retry.');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setPaymentError(null);

    try {
      await runConfirmedFeePayment(
        () => api.fees.recordPayment(activeInstitutionId, {
          studentId: activePaymentRecord.studentId,
          amount: payAmount,
          method: paymentForm.paymentMethod,
          notes: paymentForm.remarks,
          paymentDate: paymentForm.paymentDate,
          externalReference: paymentForm.externalReference.trim() || undefined,
          idempotencyKey: paymentIdempotencyKey,
        }),
        (response) => response.success === true && Boolean(response.paymentId && response.receiptNo),
        async (response) => {
          setActivePaymentRecord(null);
          setPaymentIdempotencyKey(null);
          showToast(`Recorded payment of ₹${response.amount.toLocaleString('en-IN')} for ${activePaymentRecord.studentName}! Receipt: ${response.receiptNo}`, 'success');
          await refreshFees();
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment request failed';
      const errorMessage = `Payment was not confirmed. Your entries are preserved; retry with the same details to safely check the original request. ${message}`;
      setPaymentError(errorMessage);
      showToast('Payment was not confirmed. You can safely retry with the same details.', 'error');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const data = filteredRecords.map((r, i) => ({
      Index: i + 1,
      StudentName: r.studentName,
      Class: r.class,
      AssignedFee: `₹${r.totalFees.toLocaleString('en-IN')}`,
      PaidAmount: `₹${r.paidAmount.toLocaleString('en-IN')}`,
      RemainingBalance: `₹${(r.totalFees - r.paidAmount).toLocaleString('en-IN')}`,
      Status: (r.totalFees - r.paidAmount) === 0 ? 'Paid' : (r.paidAmount > 0 ? 'Partial' : 'Unpaid'),
      DueDate: r.dueDate || 'N/A',
      ReceiptNo: r.receiptNo || 'N/A'
    }));
    downloadCSV(`Student_Fees_Report_${new Date().toISOString().split('T')[0]}.csv`, data);
    showToast(`Exported ${filteredRecords.length} student fee records to CSV`, 'success');
  };

  const handleExportPDF = () => {
    const rows = filteredRecords.map(r => {
      const remaining = r.totalFees - r.paidAmount;
      const statusLabel = remaining === 0 ? 'Fully Paid' : (r.paidAmount > 0 ? 'Partial' : 'Unpaid');
      return {
        student: r.studentName,
        class: r.class,
        assigned: `₹${r.totalFees.toLocaleString('en-IN')}`,
        paid: `₹${r.paidAmount.toLocaleString('en-IN')}`,
        balance: `₹${remaining.toLocaleString('en-IN')}`,
        status: statusLabel,
        receipt: r.receiptNo || '—'
      };
    });

    exportReportToPDF({
      title: 'Student Tuition Fee Status Report',
      subtitle: 'Complete student fee assignment, collected payments, and outstanding balances',
      metadata: [
        { label: 'Scope', value: classFilter },
        { label: 'Status Filter', value: statusFilter },
        { label: 'Total Enrolled', value: String(filteredRecords.length) }
      ],
      summaryStats: [
        { label: 'Total Assigned', value: `₹${totalAssigned.toLocaleString('en-IN')}` },
        { label: 'Total Collected', value: `₹${totalCollected.toLocaleString('en-IN')}` },
        { label: 'Outstanding Dues', value: `₹${totalOutstanding.toLocaleString('en-IN')}` },
        { label: 'Fully Paid Students', value: `${fullyPaidCount} of ${feeRecords.length}` }
      ],
      columns: [
        { header: 'Student Name', key: 'student', align: 'left' },
        { header: 'Class', key: 'class', align: 'left' },
        { header: 'Assigned Fee', key: 'assigned', align: 'right' },
        { header: 'Paid Amount', key: 'paid', align: 'right' },
        { header: 'Remaining Balance', key: 'balance', align: 'right' },
        { header: 'Status', key: 'status', align: 'center' },
        { header: 'Receipt No', key: 'receipt', align: 'center' }
      ],
      rows,
      filename: `Student_Fees_${new Date().toISOString().split('T')[0]}.pdf`
    });

    showToast('Generated print-ready PDF for student fees', 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Finance</span>
            <span>›</span>
            <span>Student Fees</span>
          </div>
          <h1>Student Fees Management</h1>
          <p>Streamlined fee tracking: view individual assigned fees, monitor paid/unpaid status, and record payments easily.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF}>
            <Printer size={15} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void refreshFees()}>Retry</button>
        </div>
      )}

      {/* 4 Stat Overview Cards */}
      <div className="stat-grid-4" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon purple">
            <CreditCard size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Assigned Fees</div>
            <div className="stat-value" style={{ fontSize: '20px' }}>
              ₹{totalAssigned.toLocaleString('en-IN')}
            </div>
            <div className="stat-footer">
              <span className="stat-subtext">Across {feeRecords.length} students</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Collected</div>
            <div className="stat-value" style={{ fontSize: '20px', color: '#10B981' }}>
              ₹{totalCollected.toLocaleString('en-IN')}
            </div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">{totalAssigned > 0 ? `${Math.round((totalCollected / totalAssigned) * 100)}%` : '—'}</span>
              <span className="stat-subtext">{totalAssigned > 0 ? 'Collection rate' : 'No payments collected yet'}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertCircle size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Outstanding Balance</div>
            <div className="stat-value" style={{ fontSize: '20px', color: '#EF4444' }}>
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div className="stat-footer">
              <span className="stat-subtext">{unpaidCount + partialCount} pending payments</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Receipt size={20} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Fully Paid Students</div>
            <div className="stat-value" style={{ fontSize: '20px' }}>
              {fullyPaidCount} <span style={{ fontSize: '13px', color: '#64748B' }}>/ {feeRecords.length}</span>
            </div>
            <div className="stat-footer">
              <span className="stat-subtext">{unpaidCount} unpaid • {partialCount} partial</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="filter-controls" style={{ flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Search Student</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by student name or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Payment Status</label>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid (Fully Cleared)</option>
              <option value="Partial">Partial Payment</option>
              <option value="Unpaid">Unpaid (Zero Paid)</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>Class</label>
            <select
              className="select-field"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="All Classes">All Classes</option>
              {classesList.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Student Fee Overview Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="card-title">Student Fee Directory ({filteredRecords.length})</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Assigned tuition fee amounts, payments made, and current balance
            </div>
          </div>
        </div>

        <div className="table-container data-table-desktop">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Fee Plan / Period</th>
                <th style={{ textAlign: 'right' }}>Assigned Fee</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    No student fee records match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const remaining = rec.totalFees - rec.paidAmount;
                  const isFullyPaid = remaining === 0;
                  const isPartial = rec.paidAmount > 0 && remaining > 0;
                  const isUnpaid = rec.paidAmount === 0;

                  return (
                    <tr key={rec.id}>
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                      <td>
                        <div className="user-table-cell">
                          <img src={rec.avatar} alt={rec.studentName} className="user-table-avatar" />
                          <div>
                            <span className="user-table-name">{rec.studentName}</span>
                            {rec.receiptNo && (
                              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{rec.receiptNo}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#64748B', fontSize: '13px' }}>{rec.class}</td>
                      <td style={{ color: '#334155', fontSize: '12.5px' }}>{rec.feePlan || 'Monthly Tuition'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        ₹{rec.totalFees.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#10B981' }}>
                        ₹{rec.paidAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#EF4444' : '#10B981' }}>
                        ₹{remaining.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isFullyPaid && <span className="badge badge-success">Paid</span>}
                        {isPartial && <span className="badge badge-warning">Partial</span>}
                        {isUnpaid && <span className="badge badge-danger">Unpaid</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isFullyPaid ? (
                          <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Cleared</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => openPaymentModal(rec)}
                          >
                            Record Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Payment Record Cards */}
        <div className="data-cards-mobile">
          {filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
              No fee records found.
            </div>
          ) : (
            filteredRecords.map((rec) => {
              const remaining = rec.totalFees - rec.paidAmount;
              const isFullyPaid = remaining === 0;
              const isPartial = rec.paidAmount > 0 && remaining > 0;
              const isUnpaid = rec.paidAmount === 0;

              return (
                <div key={rec.id} className="responsive-data-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={rec.avatar} alt={rec.studentName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{rec.studentName}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>{rec.class} • {rec.feePlan || 'Monthly Tuition'}</div>
                      </div>
                    </div>
                    <div>
                      {isFullyPaid && <span className="badge badge-success">Paid</span>}
                      {isPartial && <span className="badge badge-warning">Partial</span>}
                      {isUnpaid && <span className="badge badge-danger">Unpaid</span>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Total Fee</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                        ₹{rec.totalFees.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Paid</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>
                        ₹{rec.paidAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>Due Balance</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: remaining > 0 ? '#EF4444' : '#10B981', marginTop: '2px' }}>
                        ₹{remaining.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                      {rec.receiptNo ? (
                        <span>Receipt: <strong style={{ color: '#0F172A' }}>{rec.receiptNo}</strong></span>
                      ) : (
                        <span>No receipt generated</span>
                      )}
                    </div>
                    {isFullyPaid ? (
                      <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 700 }}>Cleared</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '6px 14px', fontSize: '12px' }}
                        onClick={() => openPaymentModal(rec)}
                      >
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {activePaymentRecord && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setActivePaymentRecord(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Record Fee Payment</h2>
              <button disabled={isSubmitting} onClick={() => !isSubmitting && setActivePaymentRecord(null)} aria-label="Close modal">
                <X size={20} color="#64748B" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                {paymentError && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '12.5px', fontWeight: 600 }}>
                    {paymentError}
                  </div>
                )}

                {/* Student Info Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>{activePaymentRecord.studentName}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{activePaymentRecord.class} • {activePaymentRecord.feePlan}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#94A3B8' }}>Assigned</div>
                      <div style={{ fontWeight: 700 }}>₹{activePaymentRecord.totalFees.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94A3B8' }}>Already Paid</div>
                      <div style={{ fontWeight: 700, color: '#10B981' }}>₹{activePaymentRecord.paidAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94A3B8' }}>Remaining Due</div>
                      <div style={{ fontWeight: 800, color: '#EF4444' }}>
                        ₹{(activePaymentRecord.totalFees - activePaymentRecord.paidAmount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Amount to Record (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={activePaymentRecord.totalFees - activePaymentRecord.paidAmount}
                    value={paymentForm.amount}
                    disabled={isSubmitting}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 700 }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                    Max allowed for full clearance: ₹{(activePaymentRecord.totalFees - activePaymentRecord.paidAmount).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Payment Method
                    </label>
                    <select
                      value={paymentForm.paymentMethod}
                      disabled={isSubmitting}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash at Center</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().split('T')[0]}
                      value={paymentForm.paymentDate}
                      disabled={isSubmitting}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    External Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / UTR / Cheque No"
                    value={paymentForm.externalReference}
                    disabled={isSubmitting}
                    onChange={(e) => setPaymentForm({ ...paymentForm, externalReference: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    Official receipt number will be automatically generated by the system upon confirmation.
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setActivePaymentRecord(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  X,
  FileText,
  Printer,
  ShieldCheck,
  Smartphone,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { getStoredFeeRecords, getStoredStudents } from '../../utils/storage';
import { FeeRecord } from '../../types';
import { downloadSampleDocument, triggerPrint } from '../../utils/demoActions';

interface PaymentRecord {
  id: string;
  date: string;
  period: string;
  amount: number;
  method: string;
  receiptNo: string;
  status: 'Paid';
}

export const ParentFeesPage: React.FC = () => {
  const { selectedChildId, setSelectedChildId, activeInstitutionId, institutionName, showToast } = useApp();
  const [children, setChildren] = useState<any[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'Net Banking'>('UPI');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Load parent children
    api.portals.getParent(activeInstitutionId)
      .then((res) => {
        if (res && res.children) {
          setChildren(res.children);
          if (res.children.length > 0 && !selectedChildId) {
            setSelectedChildId(res.children[0].id);
          }
        }
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load children');
        const stored = getStoredStudents();
        setChildren(stored);
      });

    // Load fee records from API
    api.fees.getRecords(activeInstitutionId)
      .then((res) => {
        if (res && res.records) {
          setFeeRecords(res.records);
        } else {
          setFeeRecords([]);
        }
      })
      .catch(() => {
        setFeeRecords(getStoredFeeRecords());
      });
  }, [activeInstitutionId, selectedChildId, setSelectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  // Active child's fee record
  const childFeeRecord = useMemo(() => {
    if (!activeChild) return null;
    return feeRecords.find(
      (r) => r.studentId === activeChild.id || r.studentName === activeChild.name
    ) || null;
  }, [activeChild, feeRecords]);

  const currentFeeState = useMemo(() => {
    if (!childFeeRecord) {
      return {
        period: 'Tuition Fee',
        status: 'Paid' as const,
        dueAmount: 0,
        totalRemaining: 0,
        dueDate: '—'
      };
    }
    const isPaid = childFeeRecord.status === 'Paid' || childFeeRecord.outstandingAmount === 0;
    return {
      period: childFeeRecord.feePlan || 'Tuition Fee',
      status: isPaid ? ('Paid' as const) : ('Pending' as const),
      dueAmount: childFeeRecord.outstandingAmount,
      totalRemaining: childFeeRecord.outstandingAmount,
      dueDate: childFeeRecord.dueDate || '—'
    };
  }, [childFeeRecord]);

  // Real payment receipts derived from fee record
  const currentPayments: PaymentRecord[] = useMemo(() => {
    if (!childFeeRecord || childFeeRecord.paidAmount <= 0) return [];
    return [
      {
        id: `pay-${childFeeRecord.id}`,
        date: childFeeRecord.paymentDate || '—',
        period: childFeeRecord.feePlan || 'Tuition Fee',
        amount: childFeeRecord.paidAmount,
        method: childFeeRecord.paymentMethod || 'Cash',
        receiptNo: childFeeRecord.receiptNo || `REC-${childFeeRecord.id.substring(0, 8).toUpperCase()}`,
        status: 'Paid'
      }
    ];
  }, [childFeeRecord]);

  const handleDownloadReceipt = (receipt: PaymentRecord) => {
    if (!activeChild) return;
    downloadSampleDocument(
      `Receipt_${receipt.receiptNo}.pdf`,
      `=======================================================\n` +
      `               ${institutionName.toUpperCase()}        \n` +
      `                   OFFICIAL FEE RECEIPT                \n` +
      `=======================================================\n\n` +
      `Receipt No     : ${receipt.receiptNo}\n` +
      `Payment Date   : ${receipt.date}\n` +
      `Student Name   : ${activeChild.name}\n` +
      `Class / Grade  : ${activeChild.class || 'N/A'}\n` +
      `Roll Number    : ${activeChild.rollNo || 'N/A'}\n` +
      `Parent Name    : ${activeChild.parent?.fatherName || 'Parent'}\n` +
      `-------------------------------------------------------\n` +
      `Description    : ${receipt.period}\n` +
      `Payment Mode   : ${receipt.method}\n` +
      `Amount Paid    : ₹${receipt.amount.toLocaleString()}\n` +
      `Status         : Confirmed (Paid)\n` +
      `-------------------------------------------------------\n` +
      `Thank you for your payment!\n` +
      `=======================================================`
    );
    showToast(`Receipt ${receipt.receiptNo} downloaded as PDF`, 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Parent Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Fees & Receipts</span>
          </div>
          <h1>Fees & Receipts</h1>
          <p className="page-subtitle">
            Review monthly fee status, remaining dues, pay online, and access completed receipts.
          </p>
        </div>
      </div>

      {loadError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', color: '#991B1B', fontSize: '13px' }}>
          Unable to refresh portal data from server: {loadError}
        </div>
      )}

      {/* Child Switcher */}
      {children.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Student:</span>
          <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedChildId(c.id);
                  showToast(`Viewing fees for ${c.name}`, 'info');
                }}
                style={{
                  border: 'none',
                  background: c.id === activeChild?.id ? '#FFFFFF' : 'transparent',
                  color: c.id === activeChild?.id ? '#4F46E5' : '#475569',
                  fontWeight: c.id === activeChild?.id ? 700 : 500,
                  fontSize: '12.5px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: c.id === activeChild?.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {c.name} ({c.class})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Essential Fee Status Card */}
      <div
        className="card"
        style={{
          padding: '24px',
          marginBottom: '24px',
          border: currentFeeState.status === 'Paid' ? '1.5px solid #BBF7D0' : '1.5px solid #FDE68A',
          backgroundColor: currentFeeState.status === 'Paid' ? '#F0FDF4' : '#FFFDF5'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                Current Fee Schedule
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '5px',
                  backgroundColor: currentFeeState.status === 'Paid' ? '#DCFCE7' : '#FEF3C7',
                  color: currentFeeState.status === 'Paid' ? '#166534' : '#92400E'
                }}
              >
                {currentFeeState.status === 'Paid' ? 'No Due Pending' : 'Payment Due'}
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
              {currentFeeState.period}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px', flexWrap: 'wrap', fontSize: '13.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Amount Due: </span>
                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '16px' }}>
                  ₹{currentFeeState.dueAmount.toLocaleString()}
                </span>
              </div>
              <div style={{ height: '14px', width: '1px', backgroundColor: '#CBD5E1' }} />
              <div>
                <span style={{ color: '#64748B' }}>Due Date: </span>
                <span style={{ fontWeight: 600, color: currentFeeState.status === 'Paid' ? '#166534' : '#EF4444' }}>
                  {currentFeeState.dueDate}
                </span>
              </div>
              <div style={{ height: '14px', width: '1px', backgroundColor: '#CBD5E1' }} />
              <div>
                <span style={{ color: '#64748B' }}>Remaining Balance: </span>
                <span style={{ fontWeight: 700, color: '#334155' }}>
                  ₹{currentFeeState.totalRemaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentFeeState.status === 'Pending' ? (
              <button
                className="btn btn-primary"
                onClick={() => setIsPayModalOpen(true)}
                style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 700 }}
              >
                Pay Now (₹{currentFeeState.dueAmount.toLocaleString()})
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 700, fontSize: '14px' }}>
                <CheckCircle2 size={18} />
                <span>All Fees Cleared</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Receipts & History */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
              Payment Receipts ({currentPayments.length})
            </h3>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Official payment records for {activeChild ? activeChild.name : 'Student'}
            </div>
          </div>
        </div>

        {currentPayments.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No payment receipts found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {!activeChild
                  ? 'No child is linked to this parent account.'
                  : 'No payment transactions or receipts have been recorded yet.'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-responsive student-desktop-table">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Date Paid</th>
                    <th>Fee Description</th>
                    <th style={{ width: '130px' }}>Receipt No</th>
                    <th style={{ width: '120px' }}>Payment Mode</th>
                    <th style={{ textAlign: 'right', width: '120px' }}>Amount Paid</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Status</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPayments.map((p) => (
                    <tr key={p.id} style={{ height: '52px' }}>
                      <td style={{ fontSize: '12.5px', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {p.date}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>
                        {p.period}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4F46E5', fontWeight: 700 }}>
                        {p.receiptNo}
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#475569' }}>
                        {p.method}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                        ₹{p.amount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                          Paid
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => setSelectedReceipt(p)}
                        >
                          <Eye size={13} />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Receipt Cards */}
            <div className="student-mobile-cards">
              {currentPayments.map((p) => (
                <div key={p.id} className="student-mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                        {p.period}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {p.date} • {p.method}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4F46E5', fontWeight: 600, marginTop: '3px' }}>
                        {p.receiptNo}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>
                        ₹{p.amount.toLocaleString()}
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '10.5px', marginTop: '4px', display: 'inline-block' }}>
                        Paid
                      </span>
                    </div>
                  </div>

                  <div style={{ paddingTop: '8px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => setSelectedReceipt(p)}
                    >
                      <Eye size={13} />
                      <span>View Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Online Payment Modal */}
      {isPayModalOpen && activeChild && (
        <div className="modal-backdrop" onClick={() => setIsPayModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Pay Tuition Fee — {currentFeeState.period}
              </h3>
              <button className="btn-icon" onClick={() => setIsPayModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Student</div>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                  {activeChild.name} ({activeChild.class || 'N/A'})
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>Total Payable Amount:</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#4F46E5' }}>
                    ₹{currentFeeState.dueAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Select Payment Method
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(['UPI', 'Card', 'Net Banking'] as const).map((method) => (
                    <label
                      key={method}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: paymentMethod === method ? '2px solid #6366F1' : '1px solid #E2E8F0',
                        backgroundColor: paymentMethod === method ? '#EEF2FF' : '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        style={{ accentColor: '#6366F1' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#0F172A' }}>
                        {method === 'UPI' ? 'UPI (Google Pay, PhonePe, Paytm)' : method === 'Card' ? 'Credit / Debit Card' : 'Net Banking'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setIsPayModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    setIsPayModalOpen(false);
                    showToast('Online payment gateway integration in progress. Please contact administration for manual verification.', 'info');
                  }}
                >
                  Proceed to Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt View Modal */}
      {selectedReceipt && activeChild && (
        <div className="modal-backdrop" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Payment Receipt — {selectedReceipt.receiptNo}
              </h3>
              <button className="btn-icon" onClick={() => setSelectedReceipt(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div
                style={{
                  border: '1px dashed #CBD5E1',
                  borderRadius: '10px',
                  padding: '20px',
                  backgroundColor: '#F8FAFC',
                  marginBottom: '20px'
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{institutionName.toUpperCase()}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Official Payment Receipt</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Receipt No:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>{selectedReceipt.receiptNo}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Date:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedReceipt.date}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Student Name:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeChild.name}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Class:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{activeChild.class || 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Fee Description:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedReceipt.period}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Payment Mode:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedReceipt.method}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '2px solid #E2E8F0'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Amount Paid:</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#166534' }}>
                    ₹{selectedReceipt.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => triggerPrint()}
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleDownloadReceipt(selectedReceipt)}
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

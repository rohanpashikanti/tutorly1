import React, { useState } from 'react';
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
  Wallet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
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
  const { selectedChildId, setSelectedChildId, selectedChild, showToast } = useApp();
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'Net Banking'>('UPI');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  const isAditya = selectedChildId === 'stu-001';

  // Fee state for Aditya (Class 10)
  const [adityaFeeState, setAdityaFeeState] = useState({
    period: 'November 2026',
    status: 'Pending' as 'Pending' | 'Paid',
    dueAmount: 3000,
    totalRemaining: 12000,
    dueDate: '05 Nov 2026'
  });

  const [adityaPayments, setAdityaPayments] = useState<PaymentRecord[]>([
    { id: 'pay-1', date: '05 Oct 2026', period: 'October 2026 Tuition Fee', amount: 3000, method: 'UPI', receiptNo: 'RCPT20261005', status: 'Paid' },
    { id: 'pay-2', date: '05 Sep 2026', period: 'September 2026 Tuition Fee', amount: 3000, method: 'Card', receiptNo: 'RCPT20260905', status: 'Paid' },
    { id: 'pay-3', date: '05 Aug 2026', period: 'August 2026 Tuition Fee', amount: 3000, method: 'Net Banking', receiptNo: 'RCPT20260805', status: 'Paid' },
    { id: 'pay-4', date: '05 Jul 2026', period: 'July 2026 Tuition Fee', amount: 3000, method: 'UPI', receiptNo: 'RCPT20260705', status: 'Paid' }
  ]);

  // Fee state for Kavya (Class 9)
  const [kavyaFeeState, setKavyaFeeState] = useState({
    period: 'November 2026',
    status: 'Pending' as 'Pending' | 'Paid',
    dueAmount: 3000,
    totalRemaining: 10500,
    dueDate: '05 Nov 2026'
  });

  const [kavyaPayments, setKavyaPayments] = useState<PaymentRecord[]>([
    { id: 'kpay-1', date: '05 Oct 2026', period: 'October 2026 Tuition Fee', amount: 3000, method: 'UPI', receiptNo: 'RCPTK20261005', status: 'Paid' },
    { id: 'kpay-2', date: '05 Sep 2026', period: 'September 2026 Tuition Fee', amount: 3000, method: 'UPI', receiptNo: 'RCPTK20260905', status: 'Paid' },
    { id: 'kpay-3', date: '05 Aug 2026', period: 'August 2026 Tuition Fee', amount: 3000, method: 'Card', receiptNo: 'RCPTK20260805', status: 'Paid' }
  ]);

  const currentFeeState = isAditya ? adityaFeeState : kavyaFeeState;
  const currentPayments = isAditya ? adityaPayments : kavyaPayments;

  const handleSimulatePayment = () => {
    const newReceiptNo = `RCPT202611${Math.floor(100 + Math.random() * 900)}`;
    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      date: 'Today, 25 Oct 2026',
      period: `${currentFeeState.period} Tuition Fee`,
      amount: currentFeeState.dueAmount,
      method: paymentMethod,
      receiptNo: newReceiptNo,
      status: 'Paid'
    };

    if (isAditya) {
      setAdityaFeeState((prev) => ({
        ...prev,
        status: 'Paid',
        totalRemaining: Math.max(0, prev.totalRemaining - prev.dueAmount)
      }));
      setAdityaPayments([newPayment, ...adityaPayments]);
    } else {
      setKavyaFeeState((prev) => ({
        ...prev,
        status: 'Paid',
        totalRemaining: Math.max(0, prev.totalRemaining - prev.dueAmount)
      }));
      setKavyaPayments([newPayment, ...kavyaPayments]);
    }

    setIsPayModalOpen(false);
    showToast(`Payment of ₹${currentFeeState.dueAmount.toLocaleString()} recorded! Receipt ${newReceiptNo} created.`, 'success');
  };

  const handleDownloadReceipt = (receipt: PaymentRecord) => {
    downloadSampleDocument(
      `Receipt_${receipt.receiptNo}.pdf`,
      `=======================================================\n` +
      `               SRI SAI TUITION CENTER                  \n` +
      `                   OFFICIAL FEE RECEIPT                \n` +
      `=======================================================\n\n` +
      `Receipt No     : ${receipt.receiptNo}\n` +
      `Payment Date   : ${receipt.date}\n` +
      `Student Name   : ${selectedChild.name}\n` +
      `Class / Grade  : ${selectedChild.class}\n` +
      `Roll Number    : ${selectedChild.rollNo}\n` +
      `Parent Name    : ${selectedChild.parent?.fatherName || 'Priya Sharma'}\n` +
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

      {/* Child Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Student:</span>
        <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
          <button
            onClick={() => {
              setSelectedChildId('stu-001');
              showToast('Viewing fees for Aditya Sharma', 'info');
            }}
            style={{
              border: 'none',
              background: isAditya ? '#FFFFFF' : 'transparent',
              color: isAditya ? '#4F46E5' : '#475569',
              fontWeight: isAditya ? 700 : 500,
              fontSize: '12.5px',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: isAditya ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Aditya Sharma (Class 10)
          </button>
          <button
            onClick={() => {
              setSelectedChildId('stu-002');
              showToast('Viewing fees for Kavya Sharma', 'info');
            }}
            style={{
              border: 'none',
              background: !isAditya ? '#FFFFFF' : 'transparent',
              color: !isAditya ? '#4F46E5' : '#475569',
              fontWeight: !isAditya ? 700 : 500,
              fontSize: '12.5px',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: !isAditya ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Kavya Sharma (Class 9)
          </button>
        </div>
      </div>

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
                Current Monthly Installment
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
                {currentFeeState.status === 'Paid' ? 'Paid in Full' : 'Payment Due'}
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
              {currentFeeState.period} Tuition Fee
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '12px', flexWrap: 'wrap', fontSize: '13.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Amount Due: </span>
                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '16px' }}>
                  {currentFeeState.status === 'Paid' ? '₹0' : `₹${currentFeeState.dueAmount.toLocaleString()}`}
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
                <span style={{ color: '#64748B' }}>Remaining Academic Year Balance: </span>
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
                <span>November Fee Cleared</span>
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
              Official payment records for {isAditya ? 'Aditya Sharma' : 'Kavya Sharma'}
            </div>
          </div>
        </div>

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
      </div>

      {/* Online Payment Modal */}
      {isPayModalOpen && (
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
                  {selectedChild.name} ({selectedChild.class})
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
                  onClick={handleSimulatePayment}
                >
                  Complete Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt View Modal */}
      {selectedReceipt && (
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
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>SRI SAI TUITION CENTER</div>
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
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedChild.name}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Class:</span>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedChild.class}</div>
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

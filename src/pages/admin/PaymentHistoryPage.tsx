import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  Calendar,
  Users,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Printer,
  Share2,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV, downloadSampleDocument, triggerPrint } from '../../utils/demoActions';
import { api } from '../../api/client';

interface PaymentItem {
  id: string;
  receiptNo: string;
  date: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  class: string;
  feePlan?: string;
  amount: number;
  method: string;
  transactionId?: string;
  status: string;
  notes?: string;
}

export const PaymentHistoryPage: React.FC = () => {
  const { navigateTo, showToast, activeInstitutionId, institutionName } = useApp();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedMethod, setSelectedMethod] = useState<string>('All Methods');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentItem | null>(null);

  const loadData = async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [payRes, overRes] = await Promise.all([
        api.fees.getPayments(activeInstitutionId).catch(() => ({ payments: [] })),
        api.academics.getOverview(activeInstitutionId).catch(() => null)
      ]);
      const list: PaymentItem[] = (payRes?.payments || []).map((p: any) => ({
        id: p.id,
        receiptNo: p.receiptNo || 'RCPT-N/A',
        date: p.date || '',
        studentId: p.studentId,
        studentName: p.studentName || 'Student',
        avatar: p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        class: p.class || 'Unassigned',
        feePlan: p.feePlan || 'Tuition Fee',
        amount: p.amount || 0,
        method: p.method || 'CASH',
        transactionId: p.notes || p.receiptNo || 'N/A',
        status: p.status || 'Received'
      }));
      setPayments(list);
      setClassesList(overRes?.classes || []);
      if (list.length > 0) {
        setSelectedReceipt(list[0]);
      } else {
        setSelectedReceipt(null);
      }
    } catch (err: any) {
      console.error('Failed to load payment history:', err);
      setLoadError(err?.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [activeInstitutionId]);

  const filteredData = payments.filter((item) => {
    const matchesClass = selectedClass === 'All Classes' || item.class.includes(selectedClass);
    const matchesMethod = selectedMethod === 'All Methods' || item.method.toUpperCase() === selectedMethod.toUpperCase();
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.transactionId && item.transactionId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.receiptNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesMethod && matchesSearch;
  });

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalCount = payments.length;
  const avgPayment = totalCount > 0 ? Math.round(totalCollected / totalCount) : 0;
  const uniqueStudents = new Set(payments.map(p => p.studentId)).size;

  const handleExportCSV = () => {
    const data = filteredData.map((item) => ({
      ReceiptNo: item.receiptNo,
      Date: item.date,
      StudentName: item.studentName,
      Class: item.class,
      FeePlan: item.feePlan,
      Amount: `₹${item.amount.toLocaleString()}`,
      PaymentMethod: item.method,
      TransactionId: item.transactionId,
      Status: item.status,
    }));
    downloadCSV('Payment_History_Records.csv', data);
    showToast(`Exported ${data.length} payment records to CSV`, 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Fees & Payments</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Payment History & Receipts</span>
          </div>
          <h1>Payment History & Receipts</h1>
          <p className="page-subtitle">
            View all payment records, download receipts, and track transaction history.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

      {/* Filter Bar */}
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

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Student
            </label>
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search by name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Payment Method
            </label>
            <select
              className="form-control"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
            >
              <option value="All Methods">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Collected</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{totalCollected.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">{totalCount > 0 ? 'Recorded payments' : 'No payments collected yet'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Transactions</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{totalCount}</div>
          <div className="stat-card-subtext">{totalCount > 0 ? 'Completed transactions' : 'No transactions yet'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Average Payment</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{avgPayment.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">{totalCount > 0 ? 'Per transaction' : 'No transactions yet'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Paid Students</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">{uniqueStudents}</div>
          <div className="stat-card-subtext">{uniqueStudents > 0 ? 'Distinct students paid' : 'No students paid yet'}</div>
        </div>
      </div>

      {/* Main Grid: Payment History Table (Left) + Receipt Preview (Right) */}
      <div className="grid-split-sidebar">
        {/* Payment History Table */}
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
              <Calendar size={18} color="#6366F1" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Payment History ({filteredData.length})
              </h2>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Date</th>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Receipt No</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                      <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                        No payments found
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {payments.length === 0 ? 'No payments have been recorded for this institution yet.' : 'No transactions match the selected filters.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        backgroundColor: selectedReceipt?.id === item.id ? '#F8FAFC' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedReceipt(item)}
                    >
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                      <td style={{ fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {item.date}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                          {item.studentName}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{item.class}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>₹{item.amount.toLocaleString()}</td>
                      <td>
                        <span className="badge badge-purple">{item.method}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>
                        {item.receiptNo}
                      </td>
                      <td>
                        <span className="badge badge-success">{item.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceipt(item);
                          }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side Column: Receipt Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Receipt Preview</h3>
              </div>
              {selectedReceipt && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      const text = `FEE PAYMENT RECEIPT\nReceipt No: ${selectedReceipt.receiptNo}\nDate: ${selectedReceipt.date}\nInstitution: ${institutionName || 'Tutorly'}\nStudent Name: ${selectedReceipt.studentName}\nClass: ${selectedReceipt.class}\nFee Plan: ${selectedReceipt.feePlan || 'Tuition'}\nAmount Paid: ₹${selectedReceipt.amount.toLocaleString()}\nPayment Method: ${selectedReceipt.method}\nTransaction ID: ${selectedReceipt.transactionId}\nStatus: ${selectedReceipt.status}`;
                      downloadSampleDocument(`Receipt_${selectedReceipt.receiptNo}.txt`, text);
                      showToast(`Receipt ${selectedReceipt.receiptNo} downloaded successfully`, 'success');
                    }}
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      triggerPrint();
                      showToast(`Printing Receipt ${selectedReceipt.receiptNo}...`, 'info');
                    }}
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                </div>
              )}
            </div>

            {selectedReceipt ? (
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative'
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #CBD5E1', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>
                    {institutionName || 'Tutorly'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Official Fee Payment Receipt
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Payment Receipt</span>
                  <span className="badge badge-success">{selectedReceipt.status}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Receipt No</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedReceipt.receiptNo}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Date</span>
                    <span style={{ fontWeight: 600 }}>{selectedReceipt.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Student Name</span>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedReceipt.studentName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Class</span>
                    <span>{selectedReceipt.class}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderTop: '1px solid #E2E8F0',
                      borderBottom: '1px solid #E2E8F0',
                      marginTop: '4px'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>Amount</span>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: '#6366F1' }}>
                      ₹{selectedReceipt.amount.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Payment Method</span>
                    <span style={{ fontWeight: 600 }}>{selectedReceipt.method}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748B' }}>
                <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>No receipt selected</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>Click on a payment to preview or print its official receipt.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

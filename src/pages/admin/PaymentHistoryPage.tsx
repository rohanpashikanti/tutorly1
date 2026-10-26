import React, { useState } from 'react';
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

interface PaymentItem {
  id: string;
  receiptNo: string;
  date: string;
  studentId: string;
  studentName: string;
  avatar: string;
  class: string;
  feePlan: string;
  amount: number;
  method: 'UPI' | 'Card' | 'Cash' | 'Net Banking';
  transactionId: string;
  status: 'Paid';
}

const PAYMENT_HISTORY_DATA: PaymentItem[] = [
  {
    id: 'pay-1',
    receiptNo: 'RCPT20261028',
    date: '28 Oct 2026',
    studentId: 'stu-001',
    studentName: 'Aditya Sharma',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Tuition Monthly',
    amount: 3000,
    method: 'UPI',
    transactionId: 'UPI11234567890',
    status: 'Paid'
  },
  {
    id: 'pay-2',
    receiptNo: 'RCPT20261027',
    date: '27 Oct 2026',
    studentId: 'stu-004',
    studentName: 'Kavya Sri',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - A',
    feePlan: 'Tuition Monthly',
    amount: 2500,
    method: 'Card',
    transactionId: 'CRD9876543210',
    status: 'Paid'
  },
  {
    id: 'pay-3',
    receiptNo: 'RCPT20261025',
    date: '25 Oct 2026',
    studentId: 'stu-003',
    studentName: 'Charan Kumar',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    class: 'Class 8 - B',
    feePlan: 'Science Batch',
    amount: 1500,
    method: 'Cash',
    transactionId: 'CASH25102026',
    status: 'Paid'
  },
  {
    id: 'pay-4',
    receiptNo: 'RCPT20261022',
    date: '22 Oct 2026',
    studentId: 'stu-005',
    studentName: 'Divya Nair',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Maths Advanced',
    amount: 1500,
    method: 'UPI',
    transactionId: 'UPI1122334455',
    status: 'Paid'
  },
  {
    id: 'pay-5',
    receiptNo: 'RCPT20261020',
    date: '20 Oct 2026',
    studentId: 'stu-006',
    studentName: 'Harshith Reddy',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - A',
    feePlan: 'Tuition Monthly',
    amount: 2500,
    method: 'Card',
    transactionId: 'CRD6677889900',
    status: 'Paid'
  },
  {
    id: 'pay-6',
    receiptNo: 'RCPT20261018',
    date: '18 Oct 2026',
    studentId: 'stu-007',
    studentName: 'Nithya Sree',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    class: 'Class 8 - B',
    feePlan: 'Tuition Monthly',
    amount: 2500,
    method: 'UPI',
    transactionId: 'UPI9988776655',
    status: 'Paid'
  },
  {
    id: 'pay-7',
    receiptNo: 'RCPT20261015',
    date: '15 Oct 2026',
    studentId: 'stu-008',
    studentName: 'Manish Verma',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    class: 'Class 9 - B',
    feePlan: 'Entrance Prep',
    amount: 4000,
    method: 'Net Banking',
    transactionId: 'NBK5544332211',
    status: 'Paid'
  },
  {
    id: 'pay-8',
    receiptNo: 'RCPT20261012',
    date: '12 Oct 2026',
    studentId: 'stu-009',
    studentName: 'Bhavana Reddy',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    class: 'Class 10 - A',
    feePlan: 'Tuition Monthly',
    amount: 3000,
    method: 'UPI',
    transactionId: 'UPI17766554433',
    status: 'Paid'
  }
];

export const PaymentHistoryPage: React.FC = () => {
  const { navigateTo, showToast } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedMethod, setSelectedMethod] = useState<string>('All Methods');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentItem>(PAYMENT_HISTORY_DATA[0]);

  const filteredData = PAYMENT_HISTORY_DATA.filter((item) => {
    const matchesClass = selectedClass === 'All Classes' || item.class.includes(selectedClass);
    const matchesMethod = selectedMethod === 'All Methods' || item.method === selectedMethod;
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.receiptNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesMethod && matchesSearch;
  });

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
              <option value="Class 10">Class 10</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 8">Class 8</option>
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
              <option value="Net Banking">Net Banking</option>
            </select>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Status
            </label>
            <select className="form-control" defaultValue="All Status">
              <option value="All Status">All Status</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Date Range
            </label>
            <input type="text" className="form-control" defaultValue="01 Oct 2026 - 31 Oct 2026" readOnly />
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Payments</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹1,98,500</div>
          <div className="stat-card-trend trend-up">
            <span>↑ 12% vs last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Transactions</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">86</div>
          <div className="stat-card-trend trend-up">
            <span>↑ 8% this month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Average Payment</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹2,308</div>
          <div className="stat-card-trend trend-up">
            <span>↑ 5% this month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Paid Students</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">32</div>
          <div className="stat-card-subtext">91% of total students</div>
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
                Payment History (86)
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '13px' }}>
                <Filter size={14} />
                <span>Filter</span>
              </button>
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
                  <th>Fee Plan</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction ID</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: selectedReceipt.id === item.id ? '#F8FAFC' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedReceipt(item)}
                  >
                    <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {item.date}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={item.avatar}
                          alt={item.studentName}
                          style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                          {item.studentName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{item.class}</span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#475569' }}>{item.feePlan}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>₹{item.amount.toLocaleString()}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            item.method === 'UPI'
                              ? '#EEF2FF'
                              : item.method === 'Cash'
                              ? '#ECFDF5'
                              : '#FEF3C7',
                          color:
                            item.method === 'UPI'
                              ? '#6366F1'
                              : item.method === 'Cash'
                              ? '#10B981'
                              : '#B45309'
                        }}
                      >
                        {item.method}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>
                      {item.transactionId}
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
            <div>Showing 1-{filteredData.length} of 86 payments</div>
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

        {/* Right Side Column: Receipt Preview & Recent Payments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Printable Receipt Preview Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Receipt Preview</h3>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    const text = `FEE PAYMENT RECEIPT\nReceipt No: ${selectedReceipt.receiptNo}\nDate: ${selectedReceipt.date}\nInstitution: Sri Sai Tuition Center\nStudent Name: ${selectedReceipt.studentName}\nClass: ${selectedReceipt.class}\nFee Plan: ${selectedReceipt.feePlan}\nAmount Paid: ₹${selectedReceipt.amount.toLocaleString()}\nPayment Method: ${selectedReceipt.method}\nTransaction ID: ${selectedReceipt.transactionId}\nStatus: ${selectedReceipt.status}`;
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
            </div>

            {/* Structured Receipt Paper Box */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '20px',
                position: 'relative'
              }}
            >
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #CBD5E1', paddingBottom: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366F1', fontWeight: 800, fontSize: '16px' }}>
                  <span>Tutorly</span>
                </div>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px', marginTop: '2px' }}>
                  Sri Sai Tuition Center
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  Warangal, Telangana - 506001
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                  Ph: +91 98765 43210
                </div>
              </div>

              {/* Title & Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Payment Receipt</span>
                <span className="badge badge-success">Paid</span>
              </div>

              {/* Receipt Key-Value Rows */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Fee Plan</span>
                  <span>{selectedReceipt.feePlan} Fee</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Transaction ID</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{selectedReceipt.transactionId}</span>
                </div>
              </div>

              {/* Thank you footer */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px',
                  backgroundColor: '#EEF2FF',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  color: '#6366F1',
                  fontWeight: 600
                }}
              >
                💜 Thank you for your payment!
              </div>
            </div>
          </div>

          {/* Recent Payments Quick List */}
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} color="#6366F1" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Recent Payments</h3>
              </div>
              <button
                className="btn-link"
                style={{ fontSize: '12px', color: '#6366F1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => showToast('Refreshed recent payments', 'info')}
              >
                View All →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PAYMENT_HISTORY_DATA.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedReceipt(item)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={item.avatar}
                      alt={item.studentName}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>
                        {item.studentName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{item.class}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>
                      ₹{item.amount.toLocaleString()}
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      Paid
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

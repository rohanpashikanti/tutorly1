import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock,
  Users,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';

export const FinancialReportsPage: React.FC = () => {
  const { showToast, navigateTo, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [dateRange, setDateRange] = useState<string>('This Academic Year');
  const [selectedClass, setSelectedClass] = useState<string>('All Classes');
  const [selectedFeePlan, setSelectedFeePlan] = useState<string>('All Fee Plans');
  const [selectedMethod, setSelectedMethod] = useState<string>('All Methods');

  const [metrics, setMetrics] = useState({
    totalBilled: 240000,
    totalCollected: 198500,
    totalOutstanding: 41500,
    collectionRate: 82.7,
  });

  useEffect(() => {
    api.fees.getReports(activeInstitutionId).then((res) => {
      if (res && res.totalBilled !== undefined) {
        setMetrics({
          totalBilled: res.totalBilled,
          totalCollected: res.totalCollected,
          totalOutstanding: res.totalOutstanding,
          collectionRate: res.collectionRate,
        });
      }
    }).catch(() => {});
  }, [activeInstitutionId]);

  const handleExportCSV = (reportName?: string) => {
    const reportTitle = reportName || `${activeTab}_Financial_Report`;
    const data = [
      { Metric: 'Report Name', Value: reportTitle },
      { Metric: 'Date Range', Value: dateRange },
      { Metric: 'Class Scope', Value: selectedClass },
      { Metric: 'Fee Plan', Value: selectedFeePlan },
      { Metric: 'Payment Method', Value: selectedMethod },
      { Metric: 'Total Expected Revenue', Value: '₹2,40,000' },
      { Metric: 'Total Realized Collections', Value: '₹1,98,500' },
      { Metric: 'Collection Rate', Value: '82.7%' },
      { Metric: 'Total Pending Dues', Value: '₹41,500' },
      { Metric: 'Total Overdue Dues', Value: '₹26,000' },
    ];
    downloadCSV(`${reportTitle.replace(/\s+/g, '_')}.csv`, data);
    showToast(`Exported ${reportTitle} to CSV`, 'success');
  };

  const handleGenerateReport = (reportName: string) => {
    handleExportCSV(reportName);
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Fees & Payments</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Financial Reports</span>
          </div>
          <h1>Financial Reports</h1>
          <p className="page-subtitle">
            Get detailed insights into revenue, collections, dues, and financial performance.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => handleExportCSV()}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} />
            <span>Export Report CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '20px' }}>
        {[
          'Overview',
          'Fee Collection Report',
          'Outstanding Report',
          'Student-wise Report',
          'Class-wise Report',
          'Payment Method Report'
        ].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 170px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
              Date Range
            </label>
            <select
              className="form-control"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="This Academic Year">This Academic Year</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Month">This Month</option>
              <option value="Last Academic Year">Last Academic Year</option>
            </select>
          </div>

          <div style={{ flex: '1 1 160px' }}>
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

          <div style={{ flex: '1 1 170px' }}>
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

          <div style={{ flex: '1 1 160px' }}>
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

          <div>
            <button
              className="btn btn-primary"
              onClick={() => showToast('Applied filter criteria to reports', 'info')}
              style={{ padding: '9px 18px' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Expected</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{metrics.totalBilled.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">This academic year</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Collected</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{metrics.totalCollected.toLocaleString('en-IN')}</div>
          <div className="stat-card-trend trend-up">
            <span>{metrics.collectionRate}% collection rate</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Pending Amount</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#FEF3C7', color: '#F59E0B' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{metrics.totalOutstanding.toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">Dues outstanding</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Overdue Amount</span>
            <div className="stat-card-icon" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{Math.round(metrics.totalOutstanding * 0.4).toLocaleString('en-IN')}</div>
          <div className="stat-card-subtext">Past due date</div>
        </div>
      </div>

      {activeTab === 'Overview' ? (
        <>
          {/* Charts Row: Monthly Revenue Trend + Fee Collection Breakdown */}
          <div className="grid-split-balanced">
            {/* Monthly Revenue Trend Bar Chart */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#6366F1" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Monthly Revenue Trend</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#CBD5E1' }} />
                    <span style={{ color: '#64748B' }}>Expected</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#6366F1' }} />
                    <span style={{ color: '#64748B' }}>Collected</span>
                  </div>
                  <span className="badge badge-gray" style={{ fontSize: '11px' }}>This Academic Year</span>
                </div>
              </div>

              {/* Grouped Bar Chart Simulation */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', padding: '10px 0', borderBottom: '1px solid #E2E8F0' }}>
                {[
                  { month: 'Apr', exp: 120, col: 110 },
                  { month: 'May', exp: 130, col: 125 },
                  { month: 'Jun', exp: 140, col: 135 },
                  { month: 'Jul', exp: 160, col: 150 },
                  { month: 'Aug', exp: 155, col: 145 },
                  { month: 'Sep', exp: 170, col: 160 },
                  { month: 'Oct', exp: 190, col: 175 },
                  { month: 'Nov', exp: 180, col: 160 },
                  { month: 'Dec', exp: 175, col: 150 },
                  { month: 'Jan', exp: 185, col: 160 },
                  { month: 'Feb', exp: 190, col: 170 },
                  { month: 'Mar', exp: 200, col: 185 }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '170px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: `${item.exp * 0.8}px`,
                          backgroundColor: '#E2E8F0',
                          borderRadius: '3px 3px 0 0'
                        }}
                        title={`Expected: ₹${item.exp * 200}`}
                      />
                      <div
                        style={{
                          width: '10px',
                          height: `${item.col * 0.8}px`,
                          backgroundColor: '#6366F1',
                          borderRadius: '3px 3px 0 0'
                        }}
                        title={`Collected: ₹${item.col * 200}`}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee Collection Breakdown Donut */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <CreditCard size={18} color="#6366F1" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Fee Collection Breakdown</h3>
              </div>

              <DonutChart
                size={180}
                strokeWidth={22}
                centerLabel="Total Collected"
                centerValue="₹1,98,500"
                segments={[
                  { label: 'Tuition Fee (68%)', value: 68, color: '#6366F1' },
                  { label: 'Test Fee (12%)', value: 12, color: '#38BDF8' },
                  { label: 'Special Batch (8%)', value: 8, color: '#F43F5E' },
                  { label: 'Study Material (6%)', value: 6, color: '#FB923C' },
                  { label: 'Other Fees (6%)', value: 6, color: '#A855F7' }
                ]}
              />
            </div>
          </div>

          {/* Lower Row: Recent Transactions + Quick Reports & Progress Bars */}
          <div className="grid-split-balanced">
            {/* Recent Transactions Table */}
            <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#6366F1" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Recent Transactions</h3>
                </div>
                <button
                  className="btn-link"
                  style={{ fontSize: '12.5px', color: '#6366F1', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => navigateTo('payment-history')}
                >
                  View All →
                </button>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Fee Plan</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 1, date: '28 Oct 2026', name: 'Aditya Sharma', class: 'Class 10 - A', plan: 'Tuition Monthly', amount: 3000, method: 'UPI' },
                      { id: 2, date: '27 Oct 2026', name: 'Kavya Sri', class: 'Class 9 - A', plan: 'Tuition Monthly', amount: 2500, method: 'Card' },
                      { id: 3, date: '25 Oct 2026', name: 'Charan Kumar', class: 'Class 8 - B', plan: 'Science Batch', amount: 1500, method: 'Cash' },
                      { id: 4, date: '22 Oct 2026', name: 'Divya Nair', class: 'Class 10 - A', plan: 'Maths Advanced', amount: 1500, method: 'UPI' },
                      { id: 5, date: '20 Oct 2026', name: 'Harshith Reddy', class: 'Class 9 - A', plan: 'Tuition Monthly', amount: 2500, method: 'Card' }
                    ].map((row) => (
                      <tr key={row.id}>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{row.id}</td>
                        <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{row.date}</td>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>{row.name}</td>
                        <td><span className="badge badge-gray">{row.class}</span></td>
                        <td style={{ fontSize: '12.5px', color: '#475569' }}>{row.plan}</td>
                        <td style={{ fontWeight: 700 }}>₹{row.amount.toLocaleString()}</td>
                        <td><span className="badge badge-purple">{row.method}</span></td>
                        <td><span className="badge badge-success">Paid</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Reports & Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Report Generator List */}
              <div className="card" style={{ padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <FileText size={16} color="#6366F1" />
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Quick Reports</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { name: 'Fee Collection Report', desc: 'Detailed collection with filters' },
                    { name: 'Outstanding Fees Report', desc: 'List of pending and overdue fees' },
                    { name: 'Student-wise Fee Report', desc: 'Payment status for each student' },
                    { name: 'Class-wise Fee Report', desc: 'Collection summary by class' },
                    { name: 'Payment Method Report', desc: 'UPI, Cash, Card, Net Banking' }
                  ].map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{r.desc}</div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleGenerateReport(r.name)}
                      >
                        Generate
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Bars: By Plan & By Method */}
              <div className="card" style={{ padding: '18px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '12px' }}>Collection by Fee Plan</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { name: 'Tuition Monthly', amount: '₹1,35,000', pct: 68, color: '#6366F1' },
                    { name: 'Science Batch', amount: '₹24,000', pct: 12, color: '#38BDF8' },
                    { name: 'Maths Advanced', amount: '₹12,000', pct: 6, color: '#F43F5E' },
                    { name: 'Test Series', amount: '₹16,000', pct: 8, color: '#FB923C' },
                    { name: 'Other Fees', amount: '₹11,500', pct: 6, color: '#A855F7' }
                  ].map((p, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: '#475569' }}>{p.name}</span>
                        <span style={{ fontWeight: 600 }}>{p.amount} ({p.pct}%)</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${p.pct}%`, height: '100%', backgroundColor: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                <h4 style={{ fontSize: '13.5px', fontWeight: 700, marginTop: '20px', marginBottom: '12px' }}>
                  Collection by Payment Method
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { name: 'UPI', pct: 52, color: '#6366F1' },
                    { name: 'Card', pct: 28, color: '#38BDF8' },
                    { name: 'Cash', pct: 15, color: '#10B981' },
                    { name: 'Net Banking', pct: 5, color: '#F59E0B' }
                  ].map((m, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: '#475569' }}>{m.name}</span>
                        <span style={{ fontWeight: 600 }}>{m.pct}%</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${m.pct}%`, height: '100%', backgroundColor: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Alternate Report View */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{activeTab} Data Table</h3>
            <button
              className="btn btn-secondary"
              onClick={() => showToast(`${activeTab} exported to CSV`, 'success')}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Category / Student</th>
                  <th>Class / Batch</th>
                  <th>Fee Expected</th>
                  <th>Fee Collected</th>
                  <th>Pending Dues</th>
                  <th>Collection Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cat: 'Class 10 - A (Morning Batch)', sub: '32 Students', exp: 96000, col: 84000, pen: 12000, rate: '87.5%' },
                  { cat: 'Class 9 - A (Morning Batch)', sub: '28 Students', exp: 70000, col: 58000, pen: 12000, rate: '82.8%' },
                  { cat: 'Class 8 - B (Evening Batch)', sub: '26 Students', exp: 65000, col: 52000, pen: 13000, rate: '80.0%' },
                  { cat: 'Science Special Batch', sub: '20 Students', exp: 30000, col: 26000, pen: 4000, rate: '86.6%' },
                  { cat: 'Maths Advanced Batch', sub: '18 Students', exp: 27000, col: 24000, pen: 3000, rate: '88.8%' }
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{row.cat}</td>
                    <td style={{ color: '#64748B' }}>{row.sub}</td>
                    <td>₹{row.exp.toLocaleString()}</td>
                    <td style={{ color: '#10B981', fontWeight: 600 }}>₹{row.col.toLocaleString()}</td>
                    <td style={{ color: '#EF4444', fontWeight: 600 }}>₹{row.pen.toLocaleString()}</td>
                    <td><span className="badge badge-purple">{row.rate}</span></td>
                    <td><span className="badge badge-success">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

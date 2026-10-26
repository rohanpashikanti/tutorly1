import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOCK_FEE_PLANS, MOCK_FEE_RECORDS, MOCK_STUDENTS } from '../../data/mockData';
import { FeePlan } from '../../types';
import { DonutChart, BarChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';

export const FeeStructurePage: React.FC = () => {
  const { navigateTo, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'Fee Structure' | 'Student Fee Assignment' | 'Payments & Invoices' | 'Dues & Reminders' | 'Reports'>('Fee Structure');
  const [feePlans, setFeePlans] = useState<FeePlan[]>(MOCK_FEE_PLANS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newPlan, setNewPlan] = useState({
    name: '',
    type: 'Tuition Fee' as FeePlan['type'],
    classes: 'Class 10 - A, B',
    amount: 3000,
    frequency: 'Monthly' as FeePlan['frequency'],
  });

  const filteredFeePlans = feePlans.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.classes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    const data = filteredFeePlans.map((p) => ({
      PlanName: p.name,
      Type: p.type,
      Classes: p.classes,
      FeeAmount: `₹${p.amount.toLocaleString('en-IN')}`,
      Frequency: p.frequency,
      Status: p.status,
    }));
    downloadCSV('Fee_Plans_Structure.csv', data);
    showToast(`Exported ${data.length} fee plans to CSV`, 'success');
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const created: FeePlan = {
      id: `fp-${Date.now()}`,
      name: newPlan.name,
      type: newPlan.type,
      classes: newPlan.classes,
      amount: newPlan.amount,
      frequency: newPlan.frequency,
      status: 'Active',
    };
    setFeePlans([...feePlans, created]);
    setShowCreateModal(false);
    showToast(`Fee plan "${newPlan.name}" configured successfully!`, 'success');
  };

  const monthlyTrend = [
    { label: 'Apr', value: 85, color: '#C7D2FE' },
    { label: 'May', value: 95, color: '#C7D2FE' },
    { label: 'Jun', value: 110, color: '#C7D2FE' },
    { label: 'Jul', value: 125, color: '#C7D2FE' },
    { label: 'Aug', value: 140, color: '#C7D2FE' },
    { label: 'Sep', value: 155, color: '#C7D2FE' },
    { label: 'Oct', value: 184, color: '#6366F1' },
  ];

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Fees & Payments</span>
            <span>›</span>
            <span>Fee Structure & Billing</span>
          </div>
          <h1>Fee Structure & Billing</h1>
          <p>Create fee plans, assign to classes, manage student fees, track payments and generate invoices.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create Fee Plan</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }}>
        {(['Fee Structure', 'Student Fee Assignment', 'Payments & Invoices', 'Dues & Reminders', 'Reports'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              if (tab === 'Payments & Invoices') navigateTo('fee-collection');
              else if (tab === 'Dues & Reminders') navigateTo('outstanding-fees');
              else if (tab === 'Reports') navigateTo('financial-reports');
              else setActiveTab(tab);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple"><CreditCard size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Fee Plans</div>
            <div className="stat-value">{feePlans.length}</div>
            <div className="stat-footer"><span className="stat-subtext">Active plans</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">32</div>
            <div className="stat-footer"><span className="stat-subtext">With fee assigned</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><Clock size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Expected</div>
            <div className="stat-value">₹2,40,000</div>
            <div className="stat-footer"><span className="stat-subtext">This academic year</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Collected</div>
            <div className="stat-value">₹1,98,500</div>
            <div className="stat-footer"><span className="stat-badge-change positive">82.7% till date</span></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Plans Table / Tab View + Right Side Overview */}
      <div className="grid-split">
        
        {/* Table Column */}
        {activeTab === 'Fee Structure' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div className="card-title">Fee Plans ({filteredFeePlans.length})</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="search-field" style={{ minWidth: '180px' }}>
                  <Search size={14} className="field-icon" />
                  <input
                    type="text"
                    placeholder="Search fee plans..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn btn-secondary" onClick={handleExportCSV}>
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}><input type="checkbox" /></th>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Plan Name</th>
                    <th>Type</th>
                    <th>Classes</th>
                    <th>Fee Amount</th>
                    <th>Frequency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeePlans.map((plan, idx) => (
                    <tr key={plan.id}>
                      <td><input type="checkbox" /></td>
                      <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={15} />
                          </div>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{plan.name}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-purple">{plan.type}</span></td>
                      <td>{plan.classes}</td>
                      <td><strong>₹{plan.amount.toLocaleString('en-IN')}</strong></td>
                      <td style={{ color: '#64748B' }}>{plan.frequency}</td>
                      <td><span className="badge badge-success">{plan.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Student Fee Assignment' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Student Fee Allocations (Class 10)</div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadCSV('Student_Fee_Allocations.csv', [
                    { RollNo: '001', Name: 'Aditya Sharma', Class: 'Class 10 - A', AssignedPlan: 'Comprehensive Foundation (All Subjects)', TotalAnnualFee: '₹36,000', Concession: '0%', NetFee: '₹36,000' },
                    { RollNo: '002', Name: 'Bhavana Reddy', Class: 'Class 10 - A', AssignedPlan: 'Class 10 CBSE Standard Plan', TotalAnnualFee: '₹30,000', Concession: '10%', NetFee: '₹27,000' },
                    { RollNo: '003', Name: 'Charan Kumar', Class: 'Class 10 - A', AssignedPlan: 'Class 10 CBSE Standard Plan', TotalAnnualFee: '₹30,000', Concession: '0%', NetFee: '₹30,000' },
                  ]);
                  showToast('Exported student fee allocations to CSV', 'success');
                }}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Assigned Plan</th>
                    <th>Annual Fee</th>
                    <th>Scholarship / Concession</th>
                    <th>Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Aditya Sharma', roll: '001', cls: 'Class 10 - A', plan: 'Comprehensive Foundation', fee: '₹36,000', conc: 'None', net: '₹36,000', avatar: MOCK_STUDENTS[0].avatar },
                    { name: 'Bhavana Reddy', roll: '002', cls: 'Class 10 - A', plan: 'Class 10 CBSE Standard', fee: '₹30,000', conc: '10% Merit', net: '₹27,000', avatar: MOCK_STUDENTS[2].avatar },
                    { name: 'Charan Kumar', roll: '003', cls: 'Class 10 - A', plan: 'Class 10 CBSE Standard', fee: '₹30,000', conc: 'None', net: '₹30,000', avatar: MOCK_STUDENTS[3].avatar },
                  ].map((st, i) => (
                    <tr key={i}>
                      <td>
                        <div className="user-table-cell">
                          <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                          <span className="user-table-name">{st.name}</span>
                        </div>
                      </td>
                      <td>{st.cls}</td>
                      <td><span className="badge badge-purple">{st.plan}</span></td>
                      <td>{st.fee}</td>
                      <td style={{ color: st.conc !== 'None' ? '#10B981' : '#64748B', fontWeight: 600 }}>{st.conc}</td>
                      <td style={{ fontWeight: 700, color: '#6366F1' }}>{st.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Collection Overview Donut */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Fee Collection Overview</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <DonutChart value={82.7} size={120} label="82.7%" sublabel="Collection Rate" color="#6366F1" />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Collected</span>
                  <strong>₹1,98,500</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Pending</span>
                  <strong>₹41,500</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> Overdue</span>
                  <strong style={{ color: '#EF4444' }}>₹12,000</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Collection Trend Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">Monthly Collection Trend</div></div>
            <div className="card-body"><BarChart data={monthlyTrend} height={120} valueFormatter={(v) => `₹${v}k`} /></div>
          </div>

        </div>

      </div>

      {/* Create Fee Plan Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Fee Plan</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleCreatePlan}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 10 - Intensive Board Prep"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Plan Type</label>
                    <select
                      value={newPlan.type}
                      onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value as any })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Tuition Fee</option>
                      <option>Special Batch</option>
                      <option>Subject-wise</option>
                      <option>Entrance Prep</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Frequency</label>
                    <select
                      value={newPlan.frequency}
                      onChange={(e) => setNewPlan({ ...newPlan, frequency: e.target.value as any })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Yearly</option>
                      <option>One-time</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={newPlan.amount}
                      onChange={(e) => setNewPlan({ ...newPlan, amount: Number(e.target.value) })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Applicable Classes</label>
                    <input
                      type="text"
                      value={newPlan.classes}
                      onChange={(e) => setNewPlan({ ...newPlan, classes: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

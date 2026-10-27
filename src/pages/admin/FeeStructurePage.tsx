import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  X,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FeePlan, Student, FeeRecord } from '../../types';
import { DonutChart, BarChart } from '../../components/charts/Charts';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';
import { getStoredStudentFees, getStoredStudents } from '../../utils/storage';

export const FeeStructurePage: React.FC = () => {
  const { navigateTo, showToast, activeInstitutionId } = useApp();
  const [activeTab, setActiveTab] = useState<'Fee Structure' | 'Student Fee Assignment' | 'Payments & Invoices' | 'Dues & Reminders' | 'Reports'>('Fee Structure');
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [students, setStudents] = useState<Student[]>(() => getStoredStudents());
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => getStoredStudentFees());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newPlan, setNewPlan] = useState({
    name: '',
    type: 'Tuition Fee' as FeePlan['type'],
    classes: 'Class 10 - A, B',
    amount: 3000,
    frequency: 'Monthly' as FeePlan['frequency'],
  });

  const loadData = useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [plansRes, stuRes, recordsRes] = await Promise.all([
        api.fees.getPlans(activeInstitutionId).catch(() => ({ plans: [] as FeePlan[] })),
        api.students.listAll(activeInstitutionId).catch(() => [] as Student[]),
        api.fees.getRecords(activeInstitutionId).catch(() => ({ records: [] as FeeRecord[] }))
      ]);
      setFeePlans(plansRes.plans || []);
      setStudents(stuRes || []);
      setFeeRecords(recordsRes.records || []);
    } catch (err) {
      console.error('Error fetching fee data:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load fee plans');
    } finally {
      setIsLoading(false);
    }
  }, [activeInstitutionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  // Calculations
  const totalCollected = feeRecords
    .filter((r) => r.status === 'Paid')
    .reduce((acc, r) => acc + (r.paidAmount || r.totalFees || 0), 0);
  const pendingAmount = feeRecords
    .filter((r) => r.status === 'Pending')
    .reduce((acc, r) => acc + (r.outstandingAmount ?? (r.totalFees - (r.paidAmount || 0))), 0);
  const overdueAmount = feeRecords
    .filter((r) => r.status === 'Overdue')
    .reduce((acc, r) => acc + (r.outstandingAmount ?? (r.totalFees - (r.paidAmount || 0))), 0);
  const totalBilled = totalCollected + pendingAmount + overdueAmount;
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;

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

      {/* Error Banner */}
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

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
            <div className="stat-value">{isLoading ? '—' : feePlans.length}</div>
            <div className="stat-footer"><span className="stat-subtext">Configured plans</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{isLoading ? '—' : students.length}</div>
            <div className="stat-footer"><span className="stat-subtext">Enrolled students</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><Clock size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Expected</div>
            <div className="stat-value">{isLoading ? '—' : `₹${totalBilled.toLocaleString('en-IN')}`}</div>
            <div className="stat-footer"><span className="stat-subtext">This academic year</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={22} /></div>
          <div className="stat-content">
            <div className="stat-label">Total Collected</div>
            <div className="stat-value">{isLoading ? '—' : `₹${totalCollected.toLocaleString('en-IN')}`}</div>
            <div className="stat-footer"><span className="stat-subtext">{collectionRate}% till date</span></div>
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
                  {filteredFeePlans.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                        <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>
                          No fee plans found
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          {feePlans.length === 0
                            ? 'No fee plans configured yet. Click "Create Fee Plan" to set up fee structures.'
                            : 'No fee plans match the current search.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFeePlans.map((plan, idx) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Student Fee Assignment' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Student Fee Allocations</div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Admission No</th>
                    <th>Total Annual Fee</th>
                    <th>Paid</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748B' }}>
                        No students enrolled yet.
                      </td>
                    </tr>
                  ) : (
                    students.map((st) => (
                      <tr key={st.id}>
                        <td>
                          <div className="user-table-cell">
                            <img src={st.avatar} alt={st.name} className="user-table-avatar" />
                            <span className="user-table-name">{st.name}</span>
                          </div>
                        </td>
                        <td>{st.class} - {st.batch}</td>
                        <td>{st.admissionNo}</td>
                        <td>₹{(st.fees?.totalFee || 0).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#10B981', fontWeight: 600 }}>₹{(st.fees?.paidAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700, color: (st.fees?.pendingAmount || 0) > 0 ? '#EF4444' : '#64748B' }}>
                          ₹{(st.fees?.pendingAmount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
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
              <DonutChart value={collectionRate} size={120} label={`${collectionRate}%`} sublabel="Collection Rate" color="#6366F1" />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Collected</span>
                  <strong>₹{totalCollected.toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Pending</span>
                  <strong>₹{pendingAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> Overdue</span>
                  <strong style={{ color: '#EF4444' }}>₹{overdueAmount.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Collection Summary */}
          <div className="card">
            <div className="card-header"><div className="card-title">Fee Status Summary</div></div>
            <div className="card-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Total Invoices Billed</span>
                  <strong>{feeRecords.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Paid Invoices</span>
                  <strong style={{ color: '#10B981' }}>{feeRecords.filter(r => r.status === 'Paid').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Pending Invoices</span>
                  <strong style={{ color: '#F59E0B' }}>{feeRecords.filter(r => r.status === 'Pending').length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Overdue Invoices</span>
                  <strong style={{ color: '#EF4444' }}>{feeRecords.filter(r => r.status === 'Overdue').length}</strong>
                </div>
              </div>
            </div>
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
                    placeholder="e.g. Class 10 Full Year Tuition"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Fee Type</label>
                    <select
                      className="select-field"
                      style={{ width: '100%' }}
                      value={newPlan.type}
                      onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value as FeePlan['type'] })}
                    >
                      <option>Tuition Fee</option>
                      <option>Admission Fee</option>
                      <option>Exam Fee</option>
                      <option>Material / Books</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Frequency</label>
                    <select
                      className="select-field"
                      style={{ width: '100%' }}
                      value={newPlan.frequency}
                      onChange={(e) => setNewPlan({ ...newPlan, frequency: e.target.value as FeePlan['frequency'] })}
                    >
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>One-time</option>
                      <option>Annual</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Target Classes</label>
                    <input
                      type="text"
                      placeholder="e.g. Class 10 - A, B"
                      value={newPlan.classes}
                      onChange={(e) => setNewPlan({ ...newPlan, classes: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

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

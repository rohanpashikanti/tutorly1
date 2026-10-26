import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Layers,
  CalendarCheck,
  Wallet,
  TrendingUp,
  ChevronRight,
  UserPlus,
  PlusCircle,
  FileCheck,
  CreditCard,
  BookOpen,
  FileText,
  Megaphone,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DonutChart, LineTrendChart, BarChart } from '../../components/charts/Charts';
import { api } from '../../api/client';

export const AdminDashboard: React.FC = () => {
  const { navigateTo, showToast, activeInstitutionId } = useApp();
  const [performanceFilter, setPerformanceFilter] = useState<'Monthly' | 'Term' | 'Yearly'>('Monthly');
  const [performanceClass, setPerformanceClass] = useState('All Classes');
  const [feePeriod, setFeePeriod] = useState<'This Month' | 'Last Month' | 'This Term'>('This Month');
  const [summary, setSummary] = useState<{
    stats: {
      totalStudents: number;
      totalTeachers: number;
      totalClasses: number;
      totalBatches: number;
      todayAttendanceRate: number;
      todayPresentCount: number;
      todayAbsentCount: number;
      currentMonthFees: number;
    };
    upcomingEvents: any[];
    monthlyCollections: any[];
  } | null>(null);

  const [classList, setClassList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeInstitutionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    api.dashboard.getSummary(activeInstitutionId)
      .then((res) => {
        setSummary(res);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Dashboard load failed';
        console.error('Dashboard load error:', err);
        setLoadError(msg);
        showToast(msg, 'error');
      })
      .finally(() => setIsLoading(false));

    api.academics.getOverview(activeInstitutionId)
      .then((res) => {
        if (res?.classes) {
          setClassList(res.classes.map((c) => c.name));
        }
      })
      .catch(() => {});
  }, [activeInstitutionId, showToast]);

  const totalStudentsDisplay = summary?.stats ? summary.stats.totalStudents : 0;
  const totalTeachersDisplay = summary?.stats ? summary.stats.totalTeachers : 0;
  const totalClassesDisplay = summary?.stats ? summary.stats.totalClasses + summary.stats.totalBatches : 0;
  const totalMarkedToday = summary?.stats ? summary.stats.todayPresentCount + summary.stats.todayAbsentCount : 0;
  const attendanceRateDisplay = totalMarkedToday > 0 && summary ? `${summary.stats.todayAttendanceRate}%` : '—';
  const attendanceSubtextDisplay = totalMarkedToday > 0 && summary
    ? `${summary.stats.todayPresentCount} Present | ${summary.stats.todayAbsentCount} Absent`
    : 'No attendance recorded yet';

  const currentMonthRupees = summary?.stats ? summary.stats.currentMonthFees : 0;
  const feeInfo = {
    amount: `₹${currentMonthRupees.toLocaleString('en-IN')}`,
    subtext: currentMonthRupees > 0 ? 'Total collected this month' : 'No payments collected yet',
  };

  const monthlyTrendData = (summary?.monthlyCollections || []).map((m: any) => ({
    label: m.month_key || m.month || 'Month',
    value: Math.round(((m.paise ?? (m.amount ? m.amount * 100 : 0)) / 100) / 1000),
    color: '#6366F1',
  }));

  return (
    <div className="page-wrapper">
      {loadError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '16px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Error loading dashboard metrics: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* 5 Top Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card" onClick={() => navigateTo('student-directory')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{isLoading ? '—' : totalStudentsDisplay}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Active enrollment</span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('teacher-management')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Teachers</div>
            <div className="stat-value">{isLoading ? '—' : totalTeachersDisplay}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Teaching faculty</span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('classes-batches')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes & Batches</div>
            <div className="stat-value">{isLoading ? '—' : totalClassesDisplay}</div>
            <div className="stat-footer">
              <span className="stat-subtext">
                {summary ? `${summary.stats.totalClasses} Classes • ${summary.stats.totalBatches} Batches` : '0 Classes • 0 Batches'}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('attendance-register')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon orange">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Today's Attendance</div>
            <div className="stat-value">{isLoading ? '—' : attendanceRateDisplay}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{attendanceSubtextDisplay}</span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('fee-collection')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon pink">
            <Wallet size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Fees Collected</div>
            <div className="stat-value">{isLoading ? '—' : feeInfo.amount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">{feeInfo.subtext}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Performance Overview, Attendance Donut, Upcoming Events */}
      <div className="grid-hero-3">
        
        {/* Student Performance Overview */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Student Performance Overview</div>
              <div className="card-subtitle">Average subject-wise scores across tuition tests and school exams</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="tab-nav">
                {(['Monthly', 'Term', 'Yearly'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${performanceFilter === tab ? 'active' : ''}`}
                    onClick={() => setPerformanceFilter(tab)}
                    style={{ padding: '4px 10px', fontSize: '11.5px' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <select
                className="select-field"
                value={performanceClass}
                onChange={(e) => setPerformanceClass(e.target.value)}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                <option value="All Classes">All Classes</option>
                {classList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '190px', textAlign: 'center', color: '#64748B' }}>
              <BookOpen size={36} color="#CBD5E1" style={{ marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>No performance scores recorded yet</div>
              <div style={{ fontSize: '11.5px', maxWidth: '320px', marginTop: '4px' }}>
                Subject scores and performance trends will appear once tests or examinations are evaluated.
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Overview */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Attendance Overview</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <DonutChart
              value={totalMarkedToday > 0 && summary ? summary.stats.todayAttendanceRate : 0}
              size={130}
              strokeWidth={14}
              label={totalMarkedToday > 0 && summary ? `${summary.stats.todayAttendanceRate}%` : '—'}
              sublabel={totalMarkedToday > 0 ? "Present" : "No records"}
              color="#6366F1"
            />

            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Present
                </span>
                <strong style={{ color: '#0F172A' }}>{summary ? summary.stats.todayPresentCount : 0}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> Absent
                </span>
                <strong style={{ color: '#0F172A' }}>{summary ? summary.stats.todayAbsentCount : 0}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Late
                </span>
                <strong style={{ color: '#0F172A' }}>0</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94A3B8' }} /> Not Marked
                </span>
                <strong style={{ color: '#0F172A' }}>
                  {summary ? Math.max(0, summary.stats.totalStudents - totalMarkedToday) : 0}
                </strong>
              </div>
            </div>

            <button
              className="btn btn-outline"
              style={{ width: '100%', padding: '8px', fontSize: '12.5px', marginTop: '4px' }}
              onClick={() => navigateTo('attendance-register')}
            >
              Mark Attendance
            </button>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Upcoming Events</div>
            <button
              onClick={() => navigateTo('academic-calendar')}
              style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}
            >
              View All →
            </button>
          </div>
          <div className="card-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {summary?.upcomingEvents && summary.upcomingEvents.length > 0 ? (
              summary.upcomingEvents.map((evt: any) => (
                <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: '#F8FAFC' }}>
                  <div style={{ textAlign: 'center', minWidth: '36px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                      {evt.starts_at ? new Date(evt.starts_at).getDate() : '—'}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>
                      {evt.starts_at ? new Date(evt.starts_at).toLocaleString('en', { month: 'short' }).toUpperCase() : ''}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>{evt.event_type || 'Event'}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {evt.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>{evt.description || 'Calendar Event'}</div>
                  </div>
                  <ChevronRight size={16} color="#94A3B8" />
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 10px', textAlign: 'center', color: '#64748B' }}>
                <CalendarCheck size={32} color="#CBD5E1" style={{ marginBottom: '8px' }} />
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>No upcoming events scheduled</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Add tests, holidays, or meetings in the academic calendar.</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row 2: Fee Collection Bar Chart, Recent Activity, Quick Actions */}
      <div className="grid-secondary-3">
        
        {/* Fee Collection Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Fee Collection</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>{feeInfo.amount}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{feeInfo.subtext}</div>
            </div>
            <select
              className="select-field"
              value={feePeriod}
              onChange={(e) => setFeePeriod(e.target.value as any)}
              style={{ fontSize: '11.5px', padding: '4px 8px' }}
            >
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Term</option>
            </select>
          </div>
          <div className="card-body">
            {monthlyTrendData.length > 0 ? (
              <BarChart
                data={monthlyTrendData}
                height={140}
                valueFormatter={(v) => `₹${v}k`}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', textAlign: 'center', color: '#64748B' }}>
                <CreditCard size={32} color="#CBD5E1" style={{ marginBottom: '6px' }} />
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>No fee collections recorded yet</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>Recorded payments will display monthly revenue trends here.</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Activity</div>
            <button
              onClick={() => navigateTo('reports-center')}
              style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}
            >
              View All →
            </button>
          </div>
          <div className="card-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 10px', textAlign: 'center', color: '#64748B' }}>
              <Clock size={32} color="#CBD5E1" style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>No recent activity logged</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Actions such as enrollment, payments, and marks will show here.</div>
            </div>
          </div>
        </div>

        {/* Quick Actions (8 Buttons 4x2 Grid) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Quick Actions</div>
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            <div className="quick-actions-grid">
              
              <button
                onClick={() => navigateTo('student-directory')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Add Student</span>
              </button>

              <button
                onClick={() => navigateTo('teacher-management')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Add Teacher</span>
              </button>

              <button
                onClick={() => navigateTo('tuition-tests')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlusCircle size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Create Test</span>
              </button>

              <button
                onClick={() => navigateTo('attendance-register')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FFFBEB', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Mark Attendance</span>
              </button>

              <button
                onClick={() => navigateTo('fee-collection')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Record Payment</span>
              </button>

              <button
                onClick={() => navigateTo('school-exams')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FDF2F8', color: '#DB2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>School Exams</span>
              </button>

              <button
                onClick={() => navigateTo('reports-center')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileCheck size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>View Reports</span>
              </button>

              <button
                onClick={() => navigateTo('academic-calendar')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 6px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', transition: 'all 0.15s ease' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={18} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A', textAlign: 'center', lineHeight: 1.2 }}>Calendar</span>
              </button>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

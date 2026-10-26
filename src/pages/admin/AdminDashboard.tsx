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

  useEffect(() => {
    if (!activeInstitutionId) return;
    api.dashboard.getSummary(activeInstitutionId)
      .then((res) => setSummary(res))
      .catch((err) => console.error('Dashboard load error:', err));
  }, [activeInstitutionId]);

  // Trend data for Student Performance Overview
  const performanceData = performanceFilter === 'Yearly'
    ? [
        { label: '2024', line1: 65, bar: 60 },
        { label: '2025', line1: 72, bar: 68 },
        { label: '2026', line1: 79, bar: 76 }
      ]
    : performanceFilter === 'Term'
    ? [
        { label: 'Term 1 Unit 1', line1: 70, bar: 65 },
        { label: 'Term 1 Mid', line1: 74, bar: 70 },
        { label: 'Term 1 Final', line1: 79, bar: 76 },
        { label: 'Term 2 Unit 1', line1: 82, bar: 78 }
      ]
    : [
        { label: 'Jan', line1: 68, bar: 60 },
        { label: 'Feb', line1: 72, bar: 65 },
        { label: 'Mar', line1: 66, bar: 62 },
        { label: 'Apr', line1: 64, bar: 60 },
        { label: 'May', line1: 70, bar: 68 },
        { label: 'Jun', line1: 78, bar: 74 },
        { label: 'Jul', line1: 72, bar: 70 },
        { label: 'Aug', line1: 75, bar: 72 },
        { label: 'Sep', line1: 73, bar: 70 },
        { label: 'Oct', line1: 79, bar: 76 },
      ];

  // Fee collection display metrics
  const feeInfo = feePeriod === 'Last Month'
    ? { amount: '₹1,55,000', change: '+14%', subtext: 'Total collected in September 2026' }
    : feePeriod === 'This Term'
    ? { amount: '₹4,49,500', change: '+22%', subtext: 'Total collected in Term 1 (Apr - Oct 2026)' }
    : { amount: summary ? `₹${summary.stats.currentMonthFees.toLocaleString('en-IN')}` : '₹1,84,500', change: '+18%', subtext: 'Total collected in October 2026' };

  // Monthly collection data
  const feeBarData = feePeriod === 'Last Month'
    ? [
        { label: 'Apr', value: 85, color: '#C7D2FE' },
        { label: 'May', value: 95, color: '#C7D2FE' },
        { label: 'Jun', value: 110, color: '#C7D2FE' },
        { label: 'Jul', value: 125, color: '#C7D2FE' },
        { label: 'Aug', value: 140, color: '#C7D2FE' },
        { label: 'Sep', value: 155, color: '#6366F1' },
      ]
    : [
        { label: 'Apr', value: 85, color: '#C7D2FE' },
        { label: 'May', value: 95, color: '#C7D2FE' },
        { label: 'Jun', value: 110, color: '#C7D2FE' },
        { label: 'Jul', value: 125, color: '#C7D2FE' },
        { label: 'Aug', value: 140, color: '#C7D2FE' },
        { label: 'Sep', value: 155, color: '#C7D2FE' },
        { label: 'Oct', value: 184.5, color: '#6366F1' },
      ];

  const totalStudentsDisplay = summary ? summary.stats.totalStudents : 248;
  const totalTeachersDisplay = summary ? summary.stats.totalTeachers : 12;
  const totalClassesDisplay = summary ? summary.stats.totalClasses + summary.stats.totalBatches : 14;
  const attendanceRateDisplay = summary ? `${summary.stats.todayAttendanceRate}%` : '92%';
  const attendanceSubtextDisplay = summary
    ? `${summary.stats.todayPresentCount} Present | ${summary.stats.todayAbsentCount} Absent`
    : '228 Present | 20 Absent';

  return (
    <div className="page-wrapper">
      {/* 5 Top Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card" onClick={() => navigateTo('student-directory')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon purple">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Students</div>
            <div className="stat-value">{totalStudentsDisplay}</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">
                <ArrowUpRight size={13} /> +12%
              </span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('teacher-management')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Teachers</div>
            <div className="stat-value">{totalTeachersDisplay}</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">
                <ArrowUpRight size={13} /> +2
              </span>
              <span className="stat-subtext">vs last month</span>
            </div>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigateTo('classes-batches')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes & Batches</div>
            <div className="stat-value">{totalClassesDisplay}</div>
            <div className="stat-footer">
              <span className="stat-subtext">
                {summary ? `${summary.stats.totalClasses} Classes • ${summary.stats.totalBatches} Batches` : '8 Classes • 14 Batches'}
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
            <div className="stat-value">{attendanceRateDisplay}</div>
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
            <div className="stat-label">Fees Collected (Oct)</div>
            <div className="stat-value">{feeInfo.amount}</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">
                <ArrowUpRight size={13} /> +18%
              </span>
              <span className="stat-subtext">vs last month</span>
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
                <option>All Classes</option>
                <option>Class 10</option>
                <option>Class 9</option>
                <option>Class 8</option>
              </select>
            </div>
          </div>

          <div className="card-body">
            <LineTrendChart
              data={performanceData}
              height={190}
              line1Label="Tuition Tests (Avg)"
              barLabel="School Exams (Avg)"
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366F1' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>Tuition Tests (Avg)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#EEF2FF', border: '1px solid #C7D2FE' }} />
                <span style={{ color: '#475569', fontWeight: 500 }}>School Exams (Avg)</span>
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
              value={92}
              size={130}
              strokeWidth={14}
              label="92%"
              sublabel="Present"
              color="#6366F1"
            />

            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Present
                </span>
                <strong style={{ color: '#0F172A' }}>228</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> Absent
                </span>
                <strong style={{ color: '#0F172A' }}>20</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Late
                </span>
                <strong style={{ color: '#0F172A' }}>6</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94A3B8' }} /> Not Marked
                </span>
                <strong style={{ color: '#0F172A' }}>2</strong>
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: '#F8FAFC' }}>
              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>22</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>OCT</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>School Exam</span>
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Half Yearly Examination
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Class 10 • Mathematics • 9:00 AM</div>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: '#F8FAFC' }}>
              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>24</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>OCT</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '10px', padding: '1px 6px' }}>Tuition Test</span>
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Monthly Test
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Class 8 • Science • 10:00 AM</div>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: '#F8FAFC' }}>
              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>27</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>OCT</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>School Exam</span>
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Unit Test 2
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Class 9 • English • 9:00 AM</div>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: '#F8FAFC' }}>
              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>30</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>OCT</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '10px', padding: '1px 6px' }}>Tuition Test</span>
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Chapter Test - Acids & Bases
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Class 10 • Science • 4:00 PM</div>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </div>

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
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981' }}>↑ {feeInfo.change}</span>
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
            <BarChart
              data={feeBarData}
              height={140}
              valueFormatter={(v) => `₹${v}k`}
            />
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
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Fee payment received</div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>2h ago</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Rohan Verma • ₹2,500</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFFBEB', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileCheck size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Marks added for Monthly Test</div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>4h ago</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Class 8 • Science</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserPlus size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>New student enrolled</div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>6h ago</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Ananya Reddy • Class 9</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FDF2F8', color: '#EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Homework assigned</div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>8h ago</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Class 10 • Mathematics</div>
              </div>
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

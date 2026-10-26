import React from 'react';
import {
  Calendar,
  CreditCard,
  Award,
  ClipboardCheck,
  Megaphone,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredCalendarEvents } from '../../utils/storage';
import { CalendarEvent } from '../../types';
import { api } from '../../api/client';

export const ParentDashboard: React.FC = () => {
  const {
    currentUser,
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    navigateTo,
    showToast,
    activeInstitutionId
  } = useApp();

  const [parentData, setParentData] = React.useState<any>(null);

  React.useEffect(() => {
    api.portals.getParent(activeInstitutionId).then((res) => {
      if (res && res.children) {
        setParentData(res);
      }
    }).catch(() => {});
  }, [activeInstitutionId]);

  const children = parentData?.children || [];
  const activeChild = children.find((c: any) => c.id === selectedChildId) || children[0];

  // Real calendar events from unified storage
  const calendarEvents = React.useMemo(() => {
    const all = getStoredCalendarEvents();
    if (!activeChild) return all.slice(0, 4);
    const relevant = all.filter((ev) => {
      if (!ev.applicableClass || ev.applicableClass === 'All Classes') return true;
      return ev.applicableClass.includes(activeChild.class);
    });
    return relevant.length > 0 ? relevant.slice(0, 4) : all.slice(0, 4);
  }, [activeChild]);

  const getEventBadgeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'Holiday':
        return { bg: '#FEE2E2', color: '#EF4444' };
      case 'School Exam':
        return { bg: '#DCFCE7', color: '#16A34A' };
      case 'Tuition Test':
        return { bg: '#EEF2FF', color: '#6366F1' };
      case 'Meeting':
        return { bg: '#FEF3C7', color: '#D97706' };
      case 'Fee Event':
        return { bg: '#F1F5F9', color: '#475569' };
      default:
        return { bg: '#F1F5F9', color: '#64748B' };
    }
  };

  // Real fee status for active child
  const feeInfo = activeChild?.fees
    ? {
        status: activeChild.fees.status || (activeChild.fees.pendingAmount > 0 ? 'Pending' : 'Paid'),
        period: 'Current Term',
        dueAmount: activeChild.fees.pendingAmount || 0,
        totalRemaining: activeChild.fees.pendingAmount || 0,
        dueDate: activeChild.fees.pendingAmount > 0 ? 'Due Now' : '—'
      }
    : {
        status: 'Paid',
        period: 'Current Term',
        dueAmount: 0,
        totalRemaining: 0,
        dueDate: '—'
      };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Parent Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Dashboard</span>
          </div>
          <h1>Parent Dashboard</h1>
          <p className="page-subtitle">
            Welcome back! Here is today's overview and key updates for your children.
          </p>
        </div>

        {/* Dynamic Child Context Selector */}
        {children.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>Student:</span>
            <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px' }}>
              {children.map((ch: any) => {
                const isSelected = (activeChild?.id || '') === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setSelectedChildId(ch.id);
                      showToast(`Viewing updates for ${ch.name}`, 'info');
                    }}
                    style={{
                      border: 'none',
                      background: isSelected ? '#FFFFFF' : 'transparent',
                      color: isSelected ? '#4F46E5' : '#475569',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '12.5px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {ch.name} ({ch.class})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 1. Important Center Notice / Updates */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          backgroundColor: '#F8FAFC',
          borderLeft: '4px solid #6366F1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366F1',
              flexShrink: 0
            }}
          >
            <Megaphone size={18} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              Center Notice: Mid-Term Revision Classes & Practice Tests
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px' }}>
              Special revision sessions are running on schedule. Please ensure regular attendance.
            </div>
          </div>
        </div>
        <span className="badge badge-purple" style={{ fontSize: '11px', fontWeight: 600 }}>
          Today's Update
        </span>
      </div>

      {/* 2 & 3: Two Key Operational Cards: Upcoming Events & Fee Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Upcoming Events Card */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#6366F1" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Upcoming Academic Events
              </h3>
            </div>
            <button
              className="btn-link"
              style={{
                fontSize: '12.5px',
                color: '#6366F1',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
              onClick={() => navigateTo('academic-calendar')}
            >
              View Full Calendar →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {calendarEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '13px' }}>
                No upcoming events scheduled at this time.
              </div>
            ) : (
              calendarEvents.map((ev) => {
                const badge = getEventBadgeColor(ev.type);
                return (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onClick={() => navigateTo('academic-calendar')}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.description || (ev.applicableClass ? `For: ${ev.applicableClass}` : ev.type)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '5px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      {ev.date}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Simple Fee Status Summary */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#6366F1" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                  Fee Status Summary
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '5px',
                  backgroundColor: feeInfo.status === 'Paid' ? '#DCFCE7' : '#FEF3C7',
                  color: feeInfo.status === 'Paid' ? '#16A34A' : '#D97706'
                }}
              >
                {feeInfo.status === 'Paid' ? 'Paid' : 'Payment Due'}
              </span>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Current Installment ({feeInfo.period})</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>₹{feeInfo.dueAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                <span>Next Due Date:</span>
                <span style={{ fontWeight: 600, color: '#EF4444' }}>{feeInfo.dueDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                <span>Total Remaining Dues:</span>
                <span style={{ fontWeight: 600, color: '#475569' }}>₹{feeInfo.totalRemaining.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => navigateTo('parent-fees')}
            >
              Pay Now
            </button>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'center' }}
              onClick={() => navigateTo('parent-fees')}
            >
              Receipts
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quick Access Section */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>
          Quick Access
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Academic Progress */}
          <div
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => navigateTo('parent-academic')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                color: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Award size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Academic Progress
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                View test & exam scores
              </div>
            </div>
            <ChevronRight size={16} color="#94A3B8" />
          </div>

          {/* Attendance History */}
          <div
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => navigateTo('parent-attendance')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#DCFCE7',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ClipboardCheck size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Attendance
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                Review daily attendance
              </div>
            </div>
            <ChevronRight size={16} color="#94A3B8" />
          </div>

          {/* Fees & Receipts */}
          <div
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => navigateTo('parent-fees')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CreditCard size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Fees & Receipts
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                Payments & receipts
              </div>
            </div>
            <ChevronRight size={16} color="#94A3B8" />
          </div>

          {/* Academic Calendar */}
          <div
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.15s ease'
            }}
            onClick={() => navigateTo('academic-calendar')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#F1F5F9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Calendar size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Academic Calendar
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                Holidays & exam dates
              </div>
            </div>
            <ChevronRight size={16} color="#94A3B8" />
          </div>
        </div>
      </div>
    </div>
  );
};

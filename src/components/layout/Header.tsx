import React, { useState } from 'react';
import { Sun, Calendar, Bell, ChevronDown, LogOut, Check, User as UserIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const { currentUser, role, academicYear, setAcademicYear, logout, navigateTo } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  const academicYears = ['Academic Year 2026 - 2027', 'Academic Year 2025 - 2026', 'Academic Year 2024 - 2025'];

  // Dynamic date formatted for user's locale
  const today = new Date();
  const fullDateStr = today.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const compactDateStr = today.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  return (
    <header className="top-header">
      {/* Left: Date & Welcome */}
      <div className="header-left">
        <div className="greeting-block">
          <div className="greeting-icon">
            <Sun size={18} />
          </div>
          <div className="greeting-text">
            <h2 className="desktop-date">{fullDateStr}</h2>
            <h2 className="mobile-date">{compactDateStr}</h2>
            <p>Welcome back, {currentUser.name.split(' ')[0]}!</p>
          </div>
        </div>
      </div>

      {/* Right: Academic Year, Notifications, User Menu */}
      <div className="header-right">
        {/* Academic Year Selector (Desktop & Tablet) */}
        <div className="academic-selector-wrapper desktop-only" style={{ position: 'relative' }}>
          <button
            className="academic-selector"
            onClick={() => setShowYearDropdown(!showYearDropdown)}
          >
            <Calendar size={14} color="#6366F1" />
            <span className="academic-year-text">{academicYear}</span>
            <ChevronDown size={14} color="#94A3B8" />
          </button>

          {showYearDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '220px',
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              {academicYears.map((yr) => (
                <div
                  key={yr}
                  onClick={() => {
                    setAcademicYear(yr);
                    setShowYearDropdown(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: academicYear === yr ? '#EEF2FF' : 'transparent',
                    color: academicYear === yr ? '#6366F1' : '#0F172A',
                    fontWeight: academicYear === yr ? 600 : 500,
                  }}
                >
                  <span>{yr}</span>
                  {academicYear === yr && <Check size={14} color="#6366F1" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Icon Button */}
        <div style={{ position: 'relative' }}>
          <button className="icon-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications">
            <Bell size={18} />
            <span className="badge-dot" />
          </button>

          {showNotifications && (
            <div
              className="notifications-dropdown"
              style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: 'min(320px, calc(100vw - 32px))',
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                zIndex: 60,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>Notifications</span>
                <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}>Mark all read</span>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <div
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onClick={() => {
                    setShowNotifications(false);
                    navigateTo('academic-calendar');
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>Academic Calendar Updated</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.3 }}>Term 2 exams and tuition mock test dates have been scheduled.</div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '4px' }}>Today</div>
                </div>
                <div
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onClick={() => {
                    setShowNotifications(false);
                    navigateTo(role === 'parent' ? 'parent-attendance' : 'attendance-reports');
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>Attendance Register Synced</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.3 }}>Daily attendance logged for all active batches.</div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '4px' }}>Yesterday</div>
                </div>
                <div
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onClick={() => {
                    setShowNotifications(false);
                    navigateTo(role === 'parent' ? 'parent-fees' : 'fee-collection');
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>Tuition Fee Ledger Current</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.3 }}>Recent payments recorded and updated in student ledgers.</div>
                  <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '4px' }}>2 days ago</div>
                </div>
              </div>
              <div
                style={{ padding: '10px', textAlign: 'center', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontSize: '12px', fontWeight: 600, color: '#6366F1', cursor: 'pointer' }}
                onClick={() => {
                  setShowNotifications(false);
                }}
              >
                Close Notifications
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div style={{ position: 'relative' }}>
          <div className="user-profile-menu" onClick={() => setShowUserMenu(!showUserMenu)} role="button" tabIndex={0}>
            {currentUser.avatar
              ? <img src={currentUser.avatar} alt={currentUser.name} className="user-avatar" />
              : <div className="user-avatar" aria-hidden="true" style={{ display: 'grid', placeItems: 'center', color: '#6366F1', background: '#EEF2FF' }}><UserIcon size={18} /></div>}
            <div className="user-info-text desktop-only">
              <span className="user-name">{currentUser.name.split(' ')[0]}</span>
              <span className="user-role-label">{role.toUpperCase()}</span>
            </div>
            <ChevronDown size={14} color="#94A3B8" className="desktop-only" />
          </div>

          {showUserMenu && (
            <div
              className="user-menu-dropdown"
              style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: 'min(240px, calc(100vw - 32px))',
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{currentUser.name}</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>{currentUser.email}</div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#6366F1', fontWeight: 600 }}>
                  Role: {role.toUpperCase()}
                </div>
              </div>

              {/* Academic Year Selection on Mobile inside profile menu */}
              <div className="mobile-only" style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>Academic Session</div>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    color: '#0F172A',
                    background: '#F8FAFC'
                  }}
                >
                  {academicYears.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>

              <div style={{ padding: '4px 0' }}>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigateTo('institution-settings');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#334155',
                    textAlign: 'left',
                  }}
                >
                  <UserIcon size={15} color="#64748B" />
                  <span>Profile Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#EF4444',
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={15} color="#EF4444" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

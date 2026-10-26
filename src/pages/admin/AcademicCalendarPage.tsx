import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Layers,
  Award,
  Sun,
  X,
  Download,
  Trash2,
  Edit2,
  List,
  Clock,
  CheckCircle,
  Archive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent, AcademicYear } from '../../types';
import { downloadCSV } from '../../utils/demoActions';
import { api } from '../../api/client';
import { getStoredCalendarEvents, saveStoredCalendarEvents } from '../../utils/storage';

export const AcademicCalendarPage: React.FC = () => {
  const { role, showToast, activeInstitutionId } = useApp();
  const isAdmin = role === 'admin';
  const [activeTab, setActiveTab] = useState<'Calendar' | 'Academic Years' | 'Terms/Periods' | 'Holidays'>('Calendar');
  const [displayMode, setDisplayMode] = useState<'cards' | 'grid'>('cards');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // Persistent Calendar Events state
  const [events, setEvents] = useState<CalendarEvent[]>(() => getStoredCalendarEvents());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewEventDetail, setViewEventDetail] = useState<CalendarEvent | null>(null);

  // Dynamic classes for selector
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  // Academic Years state
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoadingAcademicYears, setIsLoadingAcademicYears] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearFormError, setYearFormError] = useState<string | null>(null);
  const [yearForm, setYearForm] = useState({
    name: '',
    startsOn: '',
    endsOn: '',
    status: 'planned' as AcademicYear['status'],
  });

  const months = [
    { name: 'September 2026', year: 2026, month: 8 },
    { name: 'October 2026', year: 2026, month: 9 },
    { name: 'November 2026', year: 2026, month: 10 },
    { name: 'December 2026', year: 2026, month: 11 }
  ];
  const [currentMonthIdx, setCurrentMonthIdx] = useState(1); // October 2026

  const [formState, setFormState] = useState({
    title: '',
    type: 'Tuition Test' as CalendarEvent['type'],
    date: '2026-10-25',
    endDate: '',
    time: '10:00 AM',
    applicableClass: 'All Classes',
    description: '',
  });

  const refreshEvents = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    try {
      const res = await api.calendar.list(activeInstitutionId);
      const evts = res?.events || [];
      setEvents(evts);
      saveStoredCalendarEvents(evts);
    } catch {
      // Keep cached state
    }
  }, [activeInstitutionId]);

  const loadAcademicYears = React.useCallback(async () => {
    if (!activeInstitutionId) return;
    setIsLoadingAcademicYears(true);
    try {
      const res = await api.academics.listAcademicYears(activeInstitutionId);
      setAcademicYears(res.academicYears || []);
    } catch (err: any) {
      console.error('Failed to load academic years:', err);
    } finally {
      setIsLoadingAcademicYears(false);
    }
  }, [activeInstitutionId]);

  useEffect(() => {
    void refreshEvents();
    void loadAcademicYears();
    if (activeInstitutionId) {
      api.academics.getOverview(activeInstitutionId)
        .then((res) => {
          if (res?.classes) {
            setAvailableClasses(res.classes.map((c) => c.name));
          }
        })
        .catch(() => {});
    }
  }, [activeInstitutionId, refreshEvents, loadAcademicYears]);

  // Sync to storage on state change
  const updateEventsAndPersist = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    saveStoredCalendarEvents(newEvents);
  };

  const handleExportEventsCSV = () => {
    if (events.length === 0) {
      showToast('No calendar events to export', 'info');
      return;
    }
    const data = events.map((ev) => ({
      Title: ev.title,
      Type: ev.type,
      StartDate: ev.date,
      EndDate: ev.endDate || ev.date,
      Time: ev.time || 'N/A',
      ApplicableClass: ev.applicableClass || 'All Classes',
      Description: ev.description || '',
    }));
    downloadCSV('Academic_Calendar_Events.csv', data);
    showToast(`Exported ${data.length} calendar events to CSV`, 'success');
  };

  const handleExportAcademicYearsCSV = () => {
    if (academicYears.length === 0) {
      showToast('No academic years to export', 'info');
      return;
    }
    const data = academicYears.map((ay) => ({
      Session: ay.name,
      Start: ay.starts_on,
      End: ay.ends_on,
      Status: ay.status,
      EnrolledStudents: ay.enrolled_students || 0,
    }));
    downloadCSV('Academic_Years.csv', data);
    showToast(`Exported ${data.length} academic sessions to CSV`, 'success');
  };

  const handlePrevMonth = () => {
    setCurrentMonthIdx((prev) => Math.max(0, prev - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthIdx((prev) => Math.min(months.length - 1, prev + 1));
  };

  const openNewEventModal = (initialDate?: string, defaultType?: CalendarEvent['type']) => {
    setEditingEventId(null);
    setFormError(null);
    setFormState({
      title: '',
      type: defaultType || 'Tuition Test',
      date: initialDate || new Date().toISOString().slice(0, 10),
      endDate: '',
      time: '10:00 AM',
      applicableClass: availableClasses[0] || 'All Classes',
      description: '',
    });
    setShowAddModal(true);
  };

  const openCreateYearModal = () => {
    setEditingYear(null);
    setYearFormError(null);
    const curr = new Date().getFullYear();
    setYearForm({
      name: `Academic Year ${curr} - ${curr + 1}`,
      startsOn: `${curr}-04-01`,
      endsOn: `${curr + 1}-03-31`,
      status: 'planned',
    });
    setShowYearModal(true);
  };

  const openEditYearModal = (year: AcademicYear) => {
    setEditingYear(year);
    setYearFormError(null);
    setYearForm({
      name: year.name,
      startsOn: year.starts_on,
      endsOn: year.ends_on,
      status: year.status,
    });
    setShowYearModal(true);
  };

  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setYearFormError(null);
    if (!yearForm.name.trim()) {
      setYearFormError('Academic Year name is required');
      return;
    }
    if (!yearForm.startsOn || !yearForm.endsOn) {
      setYearFormError('Start date and End date are required');
      return;
    }
    if (yearForm.endsOn < yearForm.startsOn) {
      setYearFormError('End date cannot precede start date');
      return;
    }

    try {
      if (editingYear) {
        await api.academics.updateAcademicYear(activeInstitutionId, editingYear.id, {
          name: yearForm.name.trim(),
          startsOn: yearForm.startsOn,
          endsOn: yearForm.endsOn,
          status: yearForm.status,
        });
        showToast('Academic Year updated successfully', 'success');
      } else {
        await api.academics.createAcademicYear(activeInstitutionId, {
          name: yearForm.name.trim(),
          startsOn: yearForm.startsOn,
          endsOn: yearForm.endsOn,
          status: yearForm.status,
        });
        showToast('Academic Year created successfully', 'success');
      }
      setShowYearModal(false);
      await loadAcademicYears();
    } catch (err: any) {
      setYearFormError(err?.message || 'Failed to save academic year');
    }
  };

  const handleActivateYear = async (year: AcademicYear) => {
    try {
      await api.academics.activateAcademicYear(activeInstitutionId, year.id);
      showToast(`"${year.name}" is now the active academic year`, 'success');
      await loadAcademicYears();
    } catch (err: any) {
      showToast(err?.message || 'Failed to activate academic year', 'error');
    }
  };

  const handleArchiveYear = async (year: AcademicYear) => {
    try {
      await api.academics.archiveAcademicYear(activeInstitutionId, year.id);
      showToast(`Archived "${year.name}"`, 'info');
      await loadAcademicYears();
    } catch (err: any) {
      showToast(err?.message || 'Failed to archive academic year', 'error');
    }
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setFormError(null);
    setFormState({
      title: ev.title,
      type: ev.type,
      date: ev.date,
      endDate: ev.endDate || '',
      time: ev.time || '',
      applicableClass: ev.applicableClass || 'All Classes',
      description: ev.description || '',
    });
    setShowAddModal(true);
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    try {
      await api.calendar.delete(activeInstitutionId, id);
      await refreshEvents();
    } catch {
      const updated = events.filter(e => e.id !== id);
      updateEventsAndPersist(updated);
    }
    showToast(`Deleted event: "${title}"`, 'info');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formState.title.trim()) {
      setFormError('Event title is required.');
      return;
    }
    if (!formState.date) {
      setFormError('Start date is required.');
      return;
    }
    if (formState.endDate && formState.endDate < formState.date) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    try {
      await api.calendar.create(activeInstitutionId, {
        title: formState.title.trim(),
        type: formState.type,
        date: formState.date,
        endDate: formState.endDate || undefined,
        time: formState.time || undefined,
        applicableClass: formState.applicableClass,
        description: formState.description || undefined,
      });
      await refreshEvents();
      setShowAddModal(false);
      showToast(`Event "${formState.title}" scheduled and saved persistently!`, 'success');
      return;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save event to database', 'error');
      return;
    }
  };

  const getEventBadgeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'School Exam': return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
      case 'Tuition Test': return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' };
      case 'Holiday': return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      case 'Fee Event': return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
      case 'Meeting': return { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' };
    }
  };

  // Compute calendar grid days dynamically for the active month
  const activeMonthConfig = months[currentMonthIdx];
  const daysInMonth = new Date(activeMonthConfig.year, activeMonthConfig.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(activeMonthConfig.year, activeMonthConfig.month, 1).getDay(); // 0=Sun..6=Sat
  const daysInPrevMonth = new Date(activeMonthConfig.year, activeMonthConfig.month, 0).getDate();

  const calendarCells = [];
  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      inMonth: false,
      dateStr: ''
    });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(activeMonthConfig.month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${activeMonthConfig.year}-${mm}-${dd}`;
    const dayEvents = events.filter(e => {
      if (e.date === dateStr) return true;
      if (e.endDate && e.date <= dateStr && dateStr <= e.endDate) return true;
      return false;
    });
    calendarCells.push({
      day: d,
      inMonth: true,
      dateStr,
      isToday: dateStr === '2026-10-25',
      events: dayEvents
    });
  }
  // Next month leading days to complete grid rows
  const remaining = 35 - calendarCells.length > 0 ? 35 - calendarCells.length : (42 - calendarCells.length > 0 ? 42 - calendarCells.length : 0);
  for (let d = 1; d <= remaining; d++) {
    calendarCells.push({
      day: d,
      inMonth: false,
      dateStr: ''
    });
  }

  // Count metrics
  const tuitionTestsCount = events.filter(e => e.type === 'Tuition Test').length;
  const schoolExamsCount = events.filter(e => e.type === 'School Exam').length;
  const holidaysCount = events.filter(e => e.type === 'Holiday').length;

  // Compute active month events for chronological schedule view
  const activeMonthEvents = events.filter((ev) => {
    const parts = ev.date.split('-');
    if (parts.length >= 2) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      if (yr !== activeMonthConfig.year || mo !== activeMonthConfig.month) {
        return false;
      }
    }
    if (categoryFilter !== 'All' && ev.type !== categoryFilter) {
      return false;
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>{role === 'parent' ? 'Parent Portal' : role === 'teacher' ? 'Teacher Portal' : 'Academic'}</span>
            <span>›</span>
            <span>Academic Calendar</span>
          </div>
          <h1>Academic Calendar</h1>
          <p>
            {role === 'parent'
              ? 'View upcoming center events, tests, exams, and holidays for your child.'
              : role === 'teacher'
              ? 'Institutional academic schedule and upcoming test calendar.'
              : 'Manage academic years, terms, and schedule events with persistent storage and instant updates.'}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleExportEventsCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          {isAdmin ? (
            <button className="btn btn-primary" onClick={() => openNewEventModal()}>
              <Plus size={16} />
              <span>Add Event</span>
            </button>
          ) : (
            <span className="badge badge-purple" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Read-only View
            </span>
          )}
        </div>
      </div>

      {/* Tabs (Admin Only) */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {(['Calendar', 'Academic Years', 'Terms/Periods', 'Holidays'] as const).map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* 4 Stat Cards (Admin Only) */}
      {isAdmin && (
        <div className="stat-grid-4" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon purple">
            <CalendarIcon size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">Live</span>
              <span className="stat-subtext">Active calendar</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Tuition Tests</div>
            <div className="stat-value">{tuitionTestsCount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Scheduled tests</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">School Exams</div>
            <div className="stat-value">{schoolExamsCount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Class assessments</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Sun size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Holidays & Breaks</div>
            <div className="stat-value">{holidaysCount}</div>
            <div className="stat-footer">
              <span className="stat-subtext">Festival & breaks</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 1. Main Calendar View Tab */}
      {activeTab === 'Calendar' && (
        <div className={isAdmin ? 'grid-split' : ''}>
          
          {/* Main Calendar Card */}
          <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
            {/* Calendar Controls Toolbar */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                backgroundColor: '#FFFFFF'
              }}
            >
              {/* Month Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    style={{ minWidth: '38px', minHeight: '38px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    style={{ minWidth: '38px', minHeight: '38px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
                    {activeMonthConfig.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {activeMonthEvents.length} {activeMonthEvents.length === 1 ? 'event' : 'events'} scheduled
                  </div>
                </div>
              </div>

              {/* View Switcher & Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* View Switcher */}
                <div
                  style={{
                    display: 'flex',
                    background: '#F1F5F9',
                    borderRadius: '8px',
                    padding: '3px',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDisplayMode('cards')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: displayMode === 'cards' ? '#FFFFFF' : 'transparent',
                      color: displayMode === 'cards' ? '#4F46E5' : '#64748B',
                      boxShadow: displayMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <List size={14} />
                    <span>Schedule Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('grid')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: displayMode === 'grid' ? '#FFFFFF' : 'transparent',
                      color: displayMode === 'grid' ? '#4F46E5' : '#64748B',
                      boxShadow: displayMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <CalendarIcon size={14} />
                    <span>Month Grid</span>
                  </button>
                </div>

                {/* Category Filter */}
                <select
                  className="select-field"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ padding: '7px 12px', fontSize: '12.5px', minWidth: '135px' }}
                  aria-label="Filter calendar events"
                >
                  <option value="All">All Categories</option>
                  <option value="Tuition Test">Tuition Tests</option>
                  <option value="School Exam">School Exams</option>
                  <option value="Holiday">Holidays</option>
                  <option value="Meeting">Meetings</option>
                  <option value="Fee Event">Fee Events</option>
                </select>
              </div>
            </div>

            <div className="card-body" style={{ padding: '20px' }}>
              {/* Mode A: Chronological Schedule Cards (Ideal for Mobile & Compact Scanning) */}
              {displayMode === 'cards' ? (
                <div>
                  {activeMonthEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                      <CalendarIcon size={32} color="#94A3B8" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                        No events found in {activeMonthConfig.name}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                        {categoryFilter !== 'All'
                          ? `No ${categoryFilter} events match the selected filter.`
                          : 'No scheduled academic events for this month.'}
                      </div>
                      {categoryFilter !== 'All' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCategoryFilter('All')}
                          style={{ marginTop: '12px' }}
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeMonthEvents.map((ev) => {
                        const badgeColor = getEventBadgeColor(ev.type);
                        const parts = ev.date.split('-');
                        const dayNum = parts[2] ? parseInt(parts[2], 10) : 1;
                        const dateObj = new Date(activeMonthConfig.year, activeMonthConfig.month, dayNum);
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                        const monthShort = activeMonthConfig.name.split(' ')[0].substring(0, 3).toUpperCase();

                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (isAdmin) {
                                openEditEventModal(ev);
                              } else {
                                setViewEventDetail(ev);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              borderRadius: '10px',
                              border: '1px solid #E2E8F0',
                              backgroundColor: '#FFFFFF',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                            }}
                            className="calendar-schedule-card"
                          >
                            {/* Date Badge Column */}
                            <div
                              style={{
                                width: '74px',
                                flexShrink: 0,
                                backgroundColor: '#F8FAFC',
                                borderRight: '1px solid #E2E8F0',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '12px 6px'
                              }}
                            >
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                                {monthShort}
                              </span>
                              <span style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                                {dayNum}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>
                                {dayName}
                              </span>
                            </div>

                            {/* Details Column */}
                            <div
                              style={{
                                padding: '14px 16px',
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: badgeColor.bg,
                                    color: badgeColor.text,
                                    border: `1px solid ${badgeColor.border}`
                                  }}
                                >
                                  {ev.type}
                                </span>
                                {ev.applicableClass && (
                                  <span className="badge badge-gray" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    {ev.applicableClass}
                                  </span>
                                )}
                                {ev.time && (
                                  <span style={{ fontSize: '11.5px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} />
                                    <span>{ev.time}</span>
                                  </span>
                                )}
                              </div>

                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                                {ev.title}
                              </h4>

                              {ev.description && (
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.4 }}>
                                  {ev.description}
                                </p>
                              )}
                            </div>

                            {/* View / Edit Action Link */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 16px',
                                color: '#4F46E5',
                                fontSize: '12px',
                                fontWeight: 600,
                                flexShrink: 0
                              }}
                            >
                              <span>{isAdmin ? 'Edit' : 'View'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Mode B: Month Grid View (with overflow container for mobile) */
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ minWidth: '580px' }}>
                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 700, fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>

                    {/* Month calendar cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                      {calendarCells.map((cell, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            if (cell.inMonth && cell.dateStr && isAdmin) {
                              openNewEventModal(cell.dateStr);
                            }
                          }}
                          style={{
                            minHeight: '80px',
                            padding: '6px',
                            background: cell.isToday ? '#F5F3FF' : cell.inMonth ? '#FFFFFF' : '#F8FAFC',
                            borderRadius: '8px',
                            border: cell.isToday ? '2px solid #6366F1' : '1px solid #E2E8F0',
                            opacity: cell.inMonth ? 1 : 0.45,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            cursor: cell.inMonth ? (isAdmin ? 'pointer' : 'default') : 'default',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: cell.isToday ? 800 : 600, color: cell.isToday ? '#6366F1' : '#334155' }}>
                              {cell.day}
                            </span>
                            {cell.isToday && (
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#6366F1', textTransform: 'uppercase' }}>Today</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                            {cell.events?.slice(0, 2).map((ev) => {
                              const styleColor = getEventBadgeColor(ev.type);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) {
                                      openEditEventModal(ev);
                                    } else {
                                      setViewEventDetail(ev);
                                    }
                                  }}
                                  title={isAdmin ? `${ev.title} (${ev.type}) - Click to edit` : `${ev.title} (${ev.type})`}
                                  style={{
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    background: styleColor.bg,
                                    color: styleColor.text,
                                    border: `1px solid ${styleColor.border}`,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {ev.title}
                                </div>
                              );
                            })}
                            {cell.events && cell.events.length > 2 && (
                              <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 600 }}>
                                +{cell.events.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Category Legends */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1D4ED8' }} /> School Exam</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5' }} /> Tuition Test</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#B45309' }} /> Holiday</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#BE185D' }} /> Meeting</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#047857' }} /> Fee Event</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Academic Year & Upcoming Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Academic Year Info (Admin Only) */}
            {isAdmin && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Academic Year</div>
                  <span className="badge badge-success">Active</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>2026 - 2027</div>
                  <div style={{ fontSize: '12.5px', color: '#64748B' }}>1 Apr 2026 - 31 Mar 2027</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '10px', background: '#F8FAFC', borderRadius: '8px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#94A3B8' }}>Total Terms</div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>2 Terms</div>
                    </div>
                    <div>
                      <div style={{ color: '#94A3B8' }}>Working Days</div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>220 Days</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Events List */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Upcoming Schedule ({events.length})</div>
                {isAdmin && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => openNewEventModal()}
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
              </div>
              <div className="card-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                {events.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#64748B', fontSize: '12.5px' }}>
                    No events scheduled.
                  </div>
                ) : (
                  [...events]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((ev) => {
                      const badgeStyle = getEventBadgeColor(ev.type);
                      const parts = ev.date.split('-');
                      const dayNumber = parts[2] || '1';
                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            if (!isAdmin) {
                              setViewEventDetail(ev);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            gap: '10px',
                            cursor: !isAdmin ? 'pointer' : 'default'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                            <div style={{ textAlign: 'center', minWidth: '32px', flexShrink: 0 }}>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{dayNumber}</div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>OCT</div>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: badgeStyle.bg,
                                    color: badgeStyle.text,
                                    border: `1px solid ${badgeStyle.border}`
                                  }}
                                >
                                  {ev.type}
                                </span>
                                {ev.applicableClass && (
                                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>• {ev.applicableClass}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ev.title}
                              </div>
                              {ev.endDate && ev.endDate !== ev.date && (
                                <div style={{ fontSize: '11px', color: '#64748B' }}>To {ev.endDate}</div>
                              )}
                            </div>
                          </div>

                          {isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '28px', height: '28px', padding: 0 }}
                                onClick={() => openEditEventModal(ev)}
                                title="Edit Event"
                              >
                                <Edit2 size={13} color="#475569" />
                              </button>
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '28px', height: '28px', padding: 0 }}
                                onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                title="Delete Event"
                              >
                                <Trash2 size={13} color="#EF4444" />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500, flexShrink: 0 }}>
                              {ev.time || 'All Day'}
                            </span>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. Academic Years Tab */}
      {activeTab === 'Academic Years' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Academic Years Configuration</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Manage historical, active, and upcoming academic sessions.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleExportAcademicYearsCSV}
              >
                <Download size={14} />
                <span>Export Sessions (CSV)</span>
              </button>
              {isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={openCreateYearModal}>
                  <Plus size={14} />
                  <span>Create Academic Year</span>
                </button>
              )}
            </div>
          </div>

          {isLoadingAcademicYears ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading academic years...</div>
          ) : academicYears.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Academic Session</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Enrolled Students</th>
                    <th>Status</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {academicYears.map((ay) => {
                    let badgeClass = 'badge-neutral';
                    if (ay.status === 'active') badgeClass = 'badge-success';
                    else if (ay.status === 'planned') badgeClass = 'badge-purple';
                    else if (ay.status === 'completed') badgeClass = 'badge-info';

                    return (
                      <tr key={ay.id}>
                        <td style={{ fontWeight: 800, color: '#0F172A' }}>{ay.name}</td>
                        <td>{ay.starts_on}</td>
                        <td>{ay.ends_on}</td>
                        <td>{ay.enrolled_students || 0} Students</td>
                        <td>
                          <span className={`badge ${badgeClass}`} style={{ textTransform: 'capitalize' }}>
                            {ay.status === 'active' ? 'Active Session' : ay.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {ay.status !== 'active' && ay.status !== 'archived' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                                  onClick={() => handleActivateYear(ay)}
                                  title="Designate as Active Year"
                                >
                                  <CheckCircle size={12} color="#10B981" />
                                  <span>Activate</span>
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ width: '28px', height: '28px', padding: 0 }}
                                onClick={() => openEditYearModal(ay)}
                                title="Edit Session"
                              >
                                <Edit2 size={13} color="#475569" />
                              </button>
                              {ay.status !== 'archived' && (
                                <button
                                  className="btn btn-secondary btn-icon"
                                  style={{ width: '28px', height: '28px', padding: 0 }}
                                  onClick={() => handleArchiveYear(ay)}
                                  title="Archive Session"
                                >
                                  <Archive size={13} color="#64748B" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
              <CalendarIcon size={44} color="#CBD5E1" style={{ marginBottom: '14px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>No academic years configured yet</div>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', marginBottom: '18px' }}>
                Create your institution's academic session to manage term dates, curriculum scheduling, and student enrollments.
              </p>
              {isAdmin && (
                <button className="btn btn-primary" onClick={openCreateYearModal}>
                  <Plus size={16} />
                  <span>Create Academic Year</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Terms / Periods Tab */}
      {activeTab === 'Terms/Periods' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Terms & Semesters</h2>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Break down the academic year into evaluative teaching periods.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <Layers size={44} color="#CBD5E1" style={{ marginBottom: '14px' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>No terms or periods configured yet</div>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px' }}>
              Break down your active academic year into evaluation periods or semesters to track working days and assessments.
            </p>
          </div>
        </div>
      )}

      {/* 4. Holidays Tab */}
      {activeTab === 'Holidays' && (() => {
        const holidays = events.filter((e) => e.type === 'Holiday');
        return (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Holiday Calendar & Breaks</h2>
                <p style={{ fontSize: '13px', color: '#64748B' }}>Official vacation schedule, national holidays, and tuition center closures.</p>
              </div>
              {isAdmin && (
                <button className="btn btn-primary btn-sm" onClick={() => openNewEventModal(undefined, 'Holiday')}>
                  <Plus size={14} />
                  <span>Add Holiday</span>
                </button>
              )}
            </div>

            {holidays.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Holiday Name</th>
                      <th>Dates</th>
                      <th>Day</th>
                      <th>Duration</th>
                      <th>Category</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => {
                      const dayName = new Date(h.date).toLocaleDateString('en-US', { weekday: 'long' });
                      let durationStr = '1 Day';
                      if (h.endDate && h.endDate !== h.date) {
                        try {
                          const diff = Math.round((new Date(h.endDate).getTime() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          if (diff > 1) durationStr = `${diff} Days`;
                        } catch {}
                      }

                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 700, color: '#0F172A' }}>{h.title}</td>
                          <td>{h.date}{h.endDate && h.endDate !== h.date ? ` - ${h.endDate}` : ''}</td>
                          <td>{dayName}</td>
                          <td>{durationStr}</td>
                          <td><span className="badge badge-info">Holiday</span></td>
                          {isAdmin && (
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  className="btn btn-secondary btn-icon"
                                  style={{ width: '28px', height: '28px', padding: 0 }}
                                  onClick={() => openEditEventModal(h)}
                                  title="Edit Holiday"
                                >
                                  <Edit2 size={13} color="#475569" />
                                </button>
                                <button
                                  className="btn btn-secondary btn-icon"
                                  style={{ width: '28px', height: '28px', padding: 0 }}
                                  onClick={() => handleDeleteEvent(h.id, h.title)}
                                  title="Delete Holiday"
                                >
                                  <Trash2 size={13} color="#EF4444" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                <Sun size={44} color="#CBD5E1" style={{ marginBottom: '14px' }} />
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>No holidays scheduled yet</div>
                <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', marginBottom: '18px' }}>
                  Official vacation schedules, national holidays, and tuition center closures will appear here once scheduled.
                </p>
                {isAdmin && (
                  <button className="btn btn-primary" onClick={() => openNewEventModal(undefined, 'Holiday')}>
                    <Plus size={16} />
                    <span>Add Holiday</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Add / Edit Event Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2 className="modal-title">{editingEventId ? 'Edit Academic Event' : 'Schedule Academic Event'}</h2>
              <button onClick={() => setShowAddModal(false)} aria-label="Close modal">
                <X size={20} color="#64748B" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ overflowY: 'auto', flex: 1 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '13px', fontWeight: 600 }}>
                    {formError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Chapter Test"
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Event Type *
                    </label>
                    <select
                      value={formState.type}
                      onChange={(e) => setFormState({ ...formState, type: e.target.value as any })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="Tuition Test">Tuition Test</option>
                      <option value="School Exam">School Exam</option>
                      <option value="Holiday">Holiday</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Fee Event">Fee Event</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Applicable Class
                    </label>
                    <select
                      value={formState.applicableClass}
                      onChange={(e) => setFormState({ ...formState, applicableClass: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option value="All Classes">All Classes</option>
                      {availableClasses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.date}
                      onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formState.endDate}
                      min={formState.date}
                      onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Time (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM - 12:00 PM"
                    value={formState.time}
                    onChange={(e) => setFormState({ ...formState, time: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Description / Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide details about syllabus, instructions, or agenda..."
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEventId ? 'Save Changes' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Academic Year Modal */}
      {showYearModal && (
        <div className="modal-backdrop" onClick={() => setShowYearModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2 className="modal-title">{editingYear ? 'Edit Academic Year' : 'Create Academic Year'}</h2>
              <button onClick={() => setShowYearModal(false)} aria-label="Close modal">
                <X size={20} color="#64748B" />
              </button>
            </div>

            <form onSubmit={handleSaveYear}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {yearFormError && (
                  <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#B91C1C', fontSize: '12.5px' }}>
                    {yearFormError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Academic Session / Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Academic Year 2026 - 2027"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={yearForm.startsOn}
                      onChange={(e) => setYearForm({ ...yearForm, startsOn: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={yearForm.startsOn}
                      value={yearForm.endsOn}
                      onChange={(e) => setYearForm({ ...yearForm, endsOn: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Initial Status
                  </label>
                  <select
                    value={yearForm.status}
                    onChange={(e) => setYearForm({ ...yearForm, status: e.target.value as any })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="planned">Planned (Upcoming session)</option>
                    <option value="active">Active (Current operating session)</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowYearModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingYear ? 'Save Changes' : 'Create Academic Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only Event Detail Modal for Parents / Teachers */}
      {viewEventDetail && (
        <div className="modal-backdrop" onClick={() => setViewEventDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Event Details</h3>
              <button className="btn-icon" onClick={() => setViewEventDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: getEventBadgeColor(viewEventDetail.type).bg,
                    color: getEventBadgeColor(viewEventDetail.type).text,
                    border: `1px solid ${getEventBadgeColor(viewEventDetail.type).border}`
                  }}
                >
                  {viewEventDetail.type}
                </span>
                <h2 style={{ margin: '8px 0 0 0', fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                  {viewEventDetail.title}
                </h2>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Date:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {viewEventDetail.date} {viewEventDetail.endDate && viewEventDetail.endDate !== viewEventDetail.date ? `to ${viewEventDetail.endDate}` : ''}
                  </span>
                </div>
                {viewEventDetail.time && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Time:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewEventDetail.time}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Applicable For:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{viewEventDetail.applicableClass || 'All Classes'}</span>
                </div>
              </div>

              {viewEventDetail.description && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Description</div>
                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                    {viewEventDetail.description}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setViewEventDetail(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

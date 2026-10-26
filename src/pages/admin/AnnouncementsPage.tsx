import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  Pin,
  Users,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Trash2,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredAnnouncements, saveStoredAnnouncements } from '../../utils/storage';
import { Announcement } from '../../types';
import { downloadCSV } from '../../utils/demoActions';

export const AnnouncementsPage: React.FC = () => {
  const { showToast, institutionName } = useApp();
  const [announcements, setAnnouncements] = useState<Announcement[]>(getStoredAnnouncements);
  const [selectedAudience, setSelectedAudience] = useState<string>('All');
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form states
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<'All' | 'Teachers' | 'Parents'>('All');
  const [priority, setPriority] = useState<'Normal' | 'Medium' | 'High'>('Normal');
  const [isPinned, setIsPinned] = useState<boolean>(false);

  const filteredAnnouncements = announcements.filter((item) => {
    const matchesAudience = selectedAudience === 'All' || item.targetAudience === selectedAudience;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAudience && matchesSearch;
  });

  const handleExportCSV = () => {
    const data = filteredAnnouncements.map((a) => ({
      Title: a.title,
      Audience: a.targetAudience,
      Date: a.date,
      Priority: a.priority,
      Pinned: a.pinned ? 'Yes' : 'No',
      Author: a.author,
      Content: a.content,
    }));
    downloadCSV('Announcements_Broadcasts.csv', data);
    showToast(`Exported ${data.length} announcements to CSV`, 'success');
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      showToast('Please provide both title and announcement content', 'warning');
      return;
    }

    const newNotice: Announcement = {
      id: `ann-${Date.now()}`,
      title,
      content,
      targetAudience,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      author: 'Administrator',
      priority,
      pinned: isPinned
    };

    const updated = [newNotice, ...announcements];
    setAnnouncements(updated);
    saveStoredAnnouncements(updated);
    setIsComposerOpen(false);
    setTitle('');
    setContent('');
    setIsPinned(false);
    showToast(`Notice published to ${targetAudience} portal.`, 'success');
  };

  const handleDelete = (id: string) => {
    const updated = announcements.filter((a) => a.id !== id);
    setAnnouncements(updated);
    saveStoredAnnouncements(updated);
    showToast('Announcement removed', 'info');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>General Administration</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Announcements</span>
          </div>
          <h1>Announcements & Broadcasts</h1>
          <p className="page-subtitle">
            Publish center notices, holiday circulars, and updates to teachers and parents.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            disabled={filteredAnnouncements.length === 0}
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsComposerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* Filter and Audience Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div className="tabs-container" style={{ margin: 0 }}>
            {['All', 'Parents', 'Teachers'].map((aud) => (
              <button
                key={aud}
                className={`tab-btn ${selectedAudience === aud ? 'active' : ''}`}
                onClick={() => setSelectedAudience(aud)}
              >
                {aud === 'All' ? 'All Audiences' : `${aud} Only`}
              </button>
            ))}
          </div>

          <div className="search-box" style={{ width: '280px' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredAnnouncements.length === 0 ? (
          <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No announcements found
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {searchQuery
                  ? 'No announcements match your search.'
                  : 'No announcements have been published yet. Click "New Announcement" to broadcast updates.'}
              </div>
              {!searchQuery && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsComposerOpen(true)}
                  style={{ marginTop: '8px' }}
                >
                  <Plus size={14} />
                  <span>Create First Announcement</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '20px',
                borderLeft: item.pinned ? '4px solid #6366F1' : '1px solid #E2E8F0',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.pinned && (
                    <span
                      className="badge badge-purple"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Pin size={11} />
                      <span>Pinned</span>
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    {item.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor:
                        item.priority === 'High'
                          ? '#FEE2E2'
                          : item.priority === 'Medium'
                          ? '#FEF3C7'
                          : '#F1F5F9',
                      color:
                        item.priority === 'High'
                          ? '#EF4444'
                          : item.priority === 'Medium'
                          ? '#F59E0B'
                          : '#64748B'
                    }}
                  >
                    {item.priority} Priority
                  </span>

                  <button
                    className="btn-icon"
                    style={{ color: '#94A3B8' }}
                    onClick={() => handleDelete(item.id)}
                    title="Delete notice"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, margin: '8px 0 16px 0' }}>
                {item.content}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #F1F5F9',
                  paddingTop: '12px',
                  fontSize: '12px',
                  color: '#64748B'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={13} color="#94A3B8" />
                    {item.date}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={13} color="#94A3B8" />
                    Audience: <strong style={{ color: '#334155' }}>{item.targetAudience}</strong>
                  </span>
                </div>

                <span style={{ color: '#94A3B8' }}>Posted by {item.author} • {institutionName}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer Modal */}
      {isComposerOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} color="#6366F1" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Compose Announcement</h3>
              </div>
              <button className="btn-icon" onClick={() => setIsComposerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '8px 12px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '11.5px', color: '#92400E' }}>
                  ℹ️ <strong>Publishing Mode:</strong> Announcement will be published immediately to targeted web portals. External WhatsApp/SMS broadcasting requires live gateway integration.
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Diwali Holiday Schedule & Revision Classes"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Target Audience
                    </label>
                    <select
                      className="form-control"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value as any)}
                    >
                      <option value="All">All (Teachers & Parents)</option>
                      <option value="Parents">Parents Only</option>
                      <option value="Teachers">Teachers Only</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Priority
                    </label>
                    <select
                      className="form-control"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High (Urgent)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Content *
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Write your announcement details here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="pinNotice"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <label htmlFor="pinNotice" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    Pin this announcement to top of feed
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsComposerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={15} />
                  <span>Publish Announcement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

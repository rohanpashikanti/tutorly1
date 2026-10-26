import React, { useState } from 'react';
import {
  Megaphone,
  Calendar,
  Pin,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Bell,
  Download,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredAnnouncements } from '../../utils/storage';
import { downloadCSV } from '../../utils/demoActions';

export const ParentAnnouncementsPage: React.FC = () => {
  const { showToast, institutionName } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const announcements = getStoredAnnouncements();

  // Filter only announcements targeted for 'All' or 'Parents'
  const parentNotices = announcements
    .filter((a) => a.targetAudience === 'All' || a.targetAudience === 'Parents')
    .filter(
      (a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleExportNotices = () => {
    const data = parentNotices.map((n) => ({
      Title: n.title,
      Date: n.date,
      Priority: n.priority,
      Content: n.content
    }));
    downloadCSV('parent_announcements.csv', data);
    showToast(`Exported ${data.length} notices to CSV`, 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>Parent Portal</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Announcements</span>
          </div>
          <h1>Center Announcements & Notices</h1>
          <p className="page-subtitle">
            Stay updated with holiday circulars, parent-teacher meetings, and examination notices.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            disabled={parentNotices.length === 0}
            onClick={handleExportNotices}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export Notices</span>
          </button>
          <div className="search-box" style={{ width: '240px' }}>
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

      {/* Notices List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {parentNotices.length === 0 ? (
          <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ maxWidth: '340px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={32} color="#94A3B8" />
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>
                No announcements published
              </div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                {searchQuery
                  ? 'No notices match your search keywords.'
                  : 'There are currently no active circulars or announcements for parents.'}
              </div>
            </div>
          </div>
        ) : (
          parentNotices.map((notice) => (
            <div
              key={notice.id}
              className="card"
              style={{
                padding: '20px',
                borderLeft: notice.pinned ? '4px solid #6366F1' : '1px solid #E2E8F0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {notice.pinned && (
                    <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Pin size={11} />
                      <span>Important</span>
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                    {notice.title}
                  </h3>
                </div>

                <span
                  className="badge"
                  style={{
                    backgroundColor: notice.priority === 'High' ? '#FEE2E2' : '#F1F5F9',
                    color: notice.priority === 'High' ? '#EF4444' : '#64748B'
                  }}
                >
                  {notice.priority} Priority
                </span>
              </div>

              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, margin: '8px 0 16px 0' }}>
                {notice.content}
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} color="#94A3B8" />
                  {notice.date}
                </span>
                <span>Issued by {institutionName}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

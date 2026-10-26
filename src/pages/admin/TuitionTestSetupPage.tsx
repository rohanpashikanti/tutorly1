import React, { useState } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  Layers,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  FileCheck,
  FileText,
  Download
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredTuitionTests, saveStoredTuitionTests } from '../../utils/storage';
import { TuitionTest } from '../../types';
import { downloadCSV } from '../../utils/demoActions';

export const TuitionTestSetupPage: React.FC = () => {
  const { navigateTo, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'Tests' | 'Question Bank' | 'Test Templates' | 'Configurations'>('Tests');
  const [tests, setTests] = useState<TuitionTest[]>(getStoredTuitionTests);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTest, setNewTest] = useState({
    name: '',
    type: 'Unit Test' as TuitionTest['type'],
    class: 'Class 10 - A',
    subject: 'Physics',
    dateTime: '2026-10-28 10:00 AM',
    durationMinutes: 60,
    maxMarks: 100,
  });

  const handleExportCSV = () => {
    const data = tests.map((t) => ({
      Name: t.name,
      Type: t.type,
      Class: t.class,
      Subject: t.subject,
      DateTime: t.dateTime,
      DurationMinutes: t.durationMinutes,
      MaxMarks: t.maxMarks,
      Status: t.status,
    }));
    downloadCSV('Tuition_Tests_List.csv', data);
    showToast(`Exported ${data.length} tuition tests to CSV`, 'success');
  };

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    const created: TuitionTest = {
      id: `tt-${Date.now()}`,
      name: newTest.name,
      type: newTest.type,
      class: newTest.class,
      subject: newTest.subject,
      dateTime: newTest.dateTime,
      durationMinutes: newTest.durationMinutes,
      maxMarks: newTest.maxMarks,
      status: 'Upcoming',
    };
    const updated = [created, ...tests];
    setTests(updated);
    saveStoredTuitionTests(updated);
    setShowCreateModal(false);
    showToast(`Tuition test "${newTest.name}" scheduled successfully!`, 'success');
  };

  const filteredTests = tests.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.class.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Tuition Tests</span>
            <span>›</span>
            <span>Test Setup</span>
          </div>
          <h1>Tuition Test Setup</h1>
          <p>Create and manage unit tests, practice tests and custom assessments for your tuition classes.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create Test</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['Tests', 'Question Bank', 'Test Templates', 'Configurations'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 5 Stat Cards */}
      <div className="stat-grid-5">
        <div className="stat-card">
          <div className="stat-icon purple">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Tests</div>
            <div className="stat-value">24</div>
            <div className="stat-footer">
              <span className="stat-subtext">This academic year</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Calendar size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Upcoming Tests</div>
            <div className="stat-value">6</div>
            <div className="stat-footer">
              <span className="stat-subtext">Next 30 days</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Ongoing Tests</div>
            <div className="stat-value">2</div>
            <div className="stat-footer">
              <span className="stat-subtext">Currently active</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Completed Tests</div>
            <div className="stat-value">16</div>
            <div className="stat-footer">
              <span className="stat-subtext">With results</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pink">
            <Award size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Average Score</div>
            <div className="stat-value">78.4%</div>
            <div className="stat-footer">
              <span className="stat-badge-change positive">↑ +5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Tests Table / Tab View + Right Setup Info */}
      <div className="grid-split">
        
        {/* Table / Tab Content Column */}
        {activeTab === 'Tests' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div className="card-title">Tests ({filteredTests.length})</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="search-field" style={{ minWidth: '180px' }}>
                  <Search size={14} className="field-icon" />
                  <input
                    type="text"
                    placeholder="Search tests..."
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
                    <th>Test Name</th>
                    <th>Type</th>
                    <th>Classes</th>
                    <th>Subjects</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                        No tests found matching "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredTests.map((test, idx) => (
                      <tr key={test.id}>
                        <td><input type="checkbox" /></td>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F5F3FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Award size={15} />
                            </div>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{test.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-purple">{test.type}</span>
                        </td>
                        <td>{test.class}</td>
                        <td>{test.subject}</td>
                        <td style={{ color: '#64748B', fontSize: '12.5px' }}>{test.dateTime}</td>
                        <td>
                          <span className={`badge ${test.status === 'Completed' ? 'badge-success' : test.status === 'Ongoing' ? 'badge-info' : 'badge-warning'}`}>
                            {test.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => navigateTo('tuition-test-marks')}
                            title="Enter Marks"
                            style={{ padding: '4px', color: '#6366F1' }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Question Bank' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Curated Question Bank (Class 10 Physics & Maths)</div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadCSV('Question_Bank.csv', [
                    { ID: 'QB-101', Subject: 'Physics', Chapter: 'Light: Reflection and Refraction', Type: 'Long Answer', Marks: 5, Difficulty: 'Medium' },
                    { ID: 'QB-102', Subject: 'Physics', Chapter: 'Electricity & Ohm Law', Type: 'Numerical', Marks: 3, Difficulty: 'Hard' },
                    { ID: 'QB-103', Subject: 'Mathematics', Chapter: 'Quadratic Equations', Type: 'Problem Solving', Marks: 4, Difficulty: 'Medium' },
                    { ID: 'QB-104', Subject: 'Mathematics', Chapter: 'Trigonometry Ratios', Type: 'Proof', Marks: 4, Difficulty: 'Hard' },
                    { ID: 'QB-105', Subject: 'Chemistry', Chapter: 'Chemical Reactions and Equations', Type: 'Short Answer', Marks: 2, Difficulty: 'Easy' },
                  ]);
                  showToast('Exported question bank items to CSV', 'success');
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
                    <th>Code</th>
                    <th>Subject</th>
                    <th>Chapter</th>
                    <th>Format</th>
                    <th>Marks</th>
                    <th>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: 'QB-101', subject: 'Physics', chapter: 'Light: Reflection & Refraction', type: 'Long Answer', marks: 5, diff: 'Medium', badge: 'badge-info' },
                    { code: 'QB-102', subject: 'Physics', chapter: 'Electricity & Ohm Law', type: 'Numerical', marks: 3, diff: 'Hard', badge: 'badge-warning' },
                    { code: 'QB-103', subject: 'Mathematics', chapter: 'Quadratic Equations', type: 'Problem Solving', marks: 4, diff: 'Medium', badge: 'badge-info' },
                    { code: 'QB-104', subject: 'Mathematics', chapter: 'Trigonometry Ratios', type: 'Proof', marks: 4, diff: 'Hard', badge: 'badge-warning' },
                    { code: 'QB-105', subject: 'Chemistry', chapter: 'Chemical Reactions & Equations', type: 'Short Answer', marks: 2, diff: 'Easy', badge: 'badge-success' },
                  ].map((q) => (
                    <tr key={q.code}>
                      <td style={{ fontWeight: 700, color: '#6366F1' }}>{q.code}</td>
                      <td style={{ fontWeight: 600 }}>{q.subject}</td>
                      <td>{q.chapter}</td>
                      <td>{q.type}</td>
                      <td style={{ fontWeight: 700 }}>{q.marks}M</td>
                      <td><span className={`badge ${q.badge}`}>{q.diff}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Test Templates' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Pre-configured Assessment Templates</div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadCSV('Test_Templates.csv', [
                    { Template: 'Weekly Chapter Revision Test', Duration: '45 mins', Marks: 25, Questions: 10 },
                    { Template: 'Bi-Weekly Comprehensive Assessment', Duration: '60 mins', Marks: 50, Questions: 15 },
                    { Template: 'Full Syllabus Board Mock Exam', Duration: '180 mins', Marks: 80, Questions: 38 },
                  ]);
                  showToast('Exported test templates to CSV', 'success');
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
                    <th>Template Name</th>
                    <th>Standard Duration</th>
                    <th>Max Marks</th>
                    <th>Standard Structure</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Weekly Chapter Revision Test', duration: '45 mins', marks: 25, structure: '5 MCQs + 3 Short + 1 Long' },
                    { name: 'Bi-Weekly Comprehensive Assessment', duration: '60 mins', marks: 50, structure: '10 MCQs + 5 Short + 2 Long' },
                    { name: 'Full Syllabus Board Mock Exam', duration: '180 mins', marks: 80, structure: 'Full CBSE Blueprint (Section A-E)' },
                  ].map((tpl, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{tpl.name}</td>
                      <td>{tpl.duration}</td>
                      <td style={{ fontWeight: 700, color: '#6366F1' }}>{tpl.marks} Marks</td>
                      <td style={{ color: '#64748B' }}>{tpl.structure}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setNewTest({
                              ...newTest,
                              name: tpl.name,
                              durationMinutes: parseInt(tpl.duration),
                              maxMarks: tpl.marks,
                            });
                            setShowCreateModal(true);
                          }}
                        >
                          Use Template
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Configurations' && (
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-title" style={{ marginBottom: '16px' }}>Tuition Test Assessment Rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Instant WhatsApp / SMS Score Card to Parents</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Automatically notify parents with test mark and rank when tutor submits test score (Integration required: WhatsApp Business API)</div>
                </div>
                <span className="badge badge-warning">Simulated in Demo</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Negative Marking for Objective MCQs</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Deduct 0.25 marks per incorrect MCQ answer for competitive foundation batches</div>
                </div>
                <input type="checkbox" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Allow Retests for Absent Students</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Enables teachers to schedule make-up tests within 7 days of the original date</div>
                </div>
                <input type="checkbox" defaultChecked />
              </div>
            </div>
          </div>
        )}

        {/* Right Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Test Types Overview */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Test Categories</div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ padding: '10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="badge badge-info" style={{ fontSize: '10px', marginBottom: '4px' }}>Unit Test</span>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Regular chapter unit evaluations</div>
              </div>
              <div style={{ padding: '10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="badge badge-success" style={{ fontSize: '10px', marginBottom: '4px' }}>Practice Test</span>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Weekly question revisions</div>
              </div>
              <div style={{ padding: '10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="badge badge-purple" style={{ fontSize: '10px', marginBottom: '4px' }}>Chapter Test</span>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Topic-wise deeper tests</div>
              </div>
              <div style={{ padding: '10px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span className="badge badge-warning" style={{ fontSize: '10px', marginBottom: '4px' }}>Model Test</span>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Full syllabus simulations</div>
              </div>
            </div>
          </div>

          {/* Quick Setup Stepper */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Setup Workflow</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>1</div>
                <div><strong>Test Details:</strong> Name, type, duration</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>2</div>
                <div><strong>Select Classes:</strong> Batch and students</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#FFFBEB', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>3</div>
                <div><strong>Choose Subjects:</strong> Chapter & max marks</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>4</div>
                <div><strong>Publish & Notify:</strong> Alert students & parents</div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Tuition Assessment</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleCreateTest}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Test Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maths Weekly Chapter 4 Test"
                    value={newTest.name}
                    onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Test Type</label>
                    <select
                      value={newTest.type}
                      onChange={(e) => setNewTest({ ...newTest, type: e.target.value as any })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Unit Test</option>
                      <option>Practice Test</option>
                      <option>Chapter Test</option>
                      <option>Model Test</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Class & Batch</label>
                    <select
                      value={newTest.class}
                      onChange={(e) => setNewTest({ ...newTest, class: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Class 10 - A</option>
                      <option>Class 10 - B</option>
                      <option>Class 9 - A</option>
                      <option>Class 8 - A</option>
                    </select>
                  </div>
                </div>

                <div className="grid-3-col" style={{ gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Subject</label>
                    <select
                      value={newTest.subject}
                      onChange={(e) => setNewTest({ ...newTest, subject: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    >
                      <option>Physics</option>
                      <option>Mathematics</option>
                      <option>Chemistry</option>
                      <option>Biology</option>
                      <option>English</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Max Marks</label>
                    <input
                      type="number"
                      value={newTest.maxMarks}
                      onChange={(e) => setNewTest({ ...newTest, maxMarks: Number(e.target.value) })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Duration (Mins)</label>
                    <input
                      type="number"
                      value={newTest.durationMinutes}
                      onChange={(e) => setNewTest({ ...newTest, durationMinutes: Number(e.target.value) })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Publish Test</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

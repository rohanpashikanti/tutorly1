import React, { useState } from 'react';
import {
  FileSpreadsheet,
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
  Award
} from 'lucide-react';
import { Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOCK_SCHOOL_EXAMS } from '../../data/mockData';
import { Exam } from '../../types';
import { downloadCSV } from '../../utils/demoActions';

export const SchoolExamSetupPage: React.FC = () => {
  const { navigateTo, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'Examinations' | 'Subjects & Marks' | 'Grading System' | 'Configurations'>('Examinations');
  const [exams, setExams] = useState<Exam[]>(MOCK_SCHOOL_EXAMS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [newExam, setNewExam] = useState({
    name: '',
    type: 'Term Exam' as Exam['type'],
    classes: '6 - 12',
    startDate: '2026-11-10',
    endDate: '2026-11-20',
  });

  const filteredExams = exams.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.classes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    const data = exams.map((e) => ({
      Name: e.name,
      Type: e.type,
      Classes: e.classes,
      SubjectsCount: e.subjectsCount,
      StartDate: e.startDate,
      EndDate: e.endDate,
      Status: e.status,
      AcademicYear: e.academicYear,
    }));
    downloadCSV('School_Examinations.csv', data);
    showToast(`Exported ${data.length} examinations to CSV`, 'success');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Exam = {
      id: `exam-${Date.now()}`,
      name: newExam.name,
      type: newExam.type,
      classes: newExam.classes,
      subjectsCount: 8,
      startDate: newExam.startDate,
      endDate: newExam.endDate,
      status: 'Upcoming',
      academicYear: '2026 - 2027',
    };
    setExams([...exams, created]);
    setShowCreateModal(false);
    setWizardStep(1);
    showToast(`School Examination "${newExam.name}" configured and published!`, 'success');
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Examinations</span>
            <span>›</span>
            <span>School Examinations</span>
            <span>›</span>
            <span>Setup</span>
          </div>
          <h1>School Examination Setup</h1>
          <p>Create and manage school examinations, subjects, and mark configurations for each class.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create New Examination</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['Examinations', 'Subjects & Marks', 'Grading System', 'Configurations'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid-4">
        <div className="stat-card">
          <div className="stat-icon purple">
            <FileSpreadsheet size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Examinations</div>
            <div className="stat-value">5</div>
            <div className="stat-footer">
              <span className="stat-subtext">This academic year</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active Examinations</div>
            <div className="stat-value">2</div>
            <div className="stat-footer">
              <span className="stat-subtext">Currently running</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Layers size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Classes Covered</div>
            <div className="stat-value">8</div>
            <div className="stat-footer">
              <span className="stat-subtext">Classes 6 - 12</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <BookOpen size={22} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Subjects</div>
            <div className="stat-value">48</div>
            <div className="stat-footer">
              <span className="stat-subtext">Across all classes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Exams Table / Tab content + Right Quick Setup Stepper & Recent Activities */}
      <div className="grid-split">
        
        {/* Main Content Card depending on activeTab */}
        {activeTab === 'Examinations' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div className="card-title">Examinations ({filteredExams.length})</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="search-field" style={{ minWidth: '200px' }}>
                  <Search size={14} className="field-icon" />
                  <input
                    type="text"
                    placeholder="Search examinations..."
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
                    <th>Examination Name</th>
                    <th>Type</th>
                    <th>Classes</th>
                    <th>Subjects</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                        No examinations match "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredExams.map((ex, idx) => (
                      <tr key={ex.id}>
                        <td><input type="checkbox" /></td>
                        <td style={{ color: '#94A3B8', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileSpreadsheet size={15} />
                            </div>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{ex.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">{ex.type}</span>
                        </td>
                        <td>{ex.classes}</td>
                        <td>{ex.subjectsCount} Subjects</td>
                        <td style={{ color: '#64748B', fontSize: '12.5px' }}>{ex.startDate}</td>
                        <td style={{ color: '#64748B', fontSize: '12.5px' }}>{ex.endDate}</td>
                        <td>
                          <span className={`badge ${ex.status === 'Completed' ? 'badge-success' : ex.status === 'Ongoing' ? 'badge-info' : 'badge-warning'}`}>
                            {ex.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => navigateTo('school-exam-marks')}
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

        {activeTab === 'Subjects & Marks' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Subject-Wise Mark Allocations (Class 10 CBSE)</div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadCSV('Subject_Mark_Allocations.csv', [
                    { Subject: 'Mathematics', TheoryMax: 80, PracticalMax: 20, TotalMax: 100, PassingMarks: 33 },
                    { Subject: 'Science', TheoryMax: 80, PracticalMax: 20, TotalMax: 100, PassingMarks: 33 },
                    { Subject: 'Social Science', TheoryMax: 80, PracticalMax: 20, TotalMax: 100, PassingMarks: 33 },
                    { Subject: 'English Language', TheoryMax: 80, PracticalMax: 20, TotalMax: 100, PassingMarks: 33 },
                    { Subject: 'Hindi / Sanskrit', TheoryMax: 80, PracticalMax: 20, TotalMax: 100, PassingMarks: 33 },
                  ]);
                  showToast('Exported subject allocations to CSV', 'success');
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
                    <th>Subject</th>
                    <th>Theory Max Marks</th>
                    <th>Internal / Practical</th>
                    <th>Total Marks</th>
                    <th>Passing Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { subject: 'Mathematics', theory: 80, practical: 20, total: 100, pass: 33 },
                    { subject: 'Science (Physics/Chem/Bio)', theory: 80, practical: 20, total: 100, pass: 33 },
                    { subject: 'Social Science', theory: 80, practical: 20, total: 100, pass: 33 },
                    { subject: 'English Language & Lit', theory: 80, practical: 20, total: 100, pass: 33 },
                    { subject: 'Hindi Course A', theory: 80, practical: 20, total: 100, pass: 33 },
                  ].map((sub, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{sub.subject}</td>
                      <td>{sub.theory}</td>
                      <td>{sub.practical}</td>
                      <td style={{ fontWeight: 700, color: '#6366F1' }}>{sub.total}</td>
                      <td><span className="badge badge-success">{sub.pass}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Grading System' && (
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Grading Scale (CBSE Standard 9-Point Scale)</div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  downloadCSV('Grading_Scale.csv', [
                    { Grade: 'A1', PercentageRange: '91% - 100%', GradePoint: '10.0', Description: 'Outstanding' },
                    { Grade: 'A2', PercentageRange: '81% - 90%', GradePoint: '9.0', Description: 'Excellent' },
                    { Grade: 'B1', PercentageRange: '71% - 80%', GradePoint: '8.0', Description: 'Very Good' },
                    { Grade: 'B2', PercentageRange: '61% - 70%', GradePoint: '7.0', Description: 'Good' },
                    { Grade: 'C1', PercentageRange: '51% - 60%', GradePoint: '6.0', Description: 'Above Average' },
                    { Grade: 'C2', PercentageRange: '41% - 50%', GradePoint: '5.0', Description: 'Average' },
                    { Grade: 'D', PercentageRange: '33% - 40%', GradePoint: '4.0', Description: 'Pass' },
                    { Grade: 'E', PercentageRange: 'Below 33%', GradePoint: '0.0', Description: 'Needs Improvement / Failed' },
                  ]);
                  showToast('Exported grading scale to CSV', 'success');
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
                    <th>Grade</th>
                    <th>Percentage Range</th>
                    <th>Grade Point</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { grade: 'A1', range: '91% - 100%', gp: '10.0', remark: 'Outstanding' },
                    { grade: 'A2', range: '81% - 90%', gp: '9.0', remark: 'Excellent' },
                    { grade: 'B1', range: '71% - 80%', gp: '8.0', remark: 'Very Good' },
                    { grade: 'B2', range: '61% - 70%', gp: '7.0', remark: 'Good' },
                    { grade: 'C1', range: '51% - 60%', gp: '6.0', remark: 'Above Average' },
                    { grade: 'C2', range: '41% - 50%', gp: '5.0', remark: 'Average' },
                    { grade: 'D', range: '33% - 40%', gp: '4.0', remark: 'Pass' },
                    { grade: 'E', range: 'Below 33%', gp: '0.0', remark: 'Needs Improvement / Failed' },
                  ].map((g, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-primary" style={{ fontWeight: 800 }}>{g.grade}</span></td>
                      <td style={{ fontWeight: 600 }}>{g.range}</td>
                      <td>{g.gp}</td>
                      <td style={{ color: '#64748B' }}>{g.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Configurations' && (
          <div className="card" style={{ padding: '24px' }}>
            <div className="card-title" style={{ marginBottom: '16px' }}>Examination Publishing & Entry Rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Lock Mark Editing After Publishing</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Teachers will not be able to edit submitted marks once admin publishes results</div>
                </div>
                <input type="checkbox" defaultChecked />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Auto-calculate Grade Points from Percentage</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>System automatically derives GPA and ranks according to CBSE rules</div>
                </div>
                <input type="checkbox" defaultChecked />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Instant SMS / Notification on Result Publishing</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Notify parents as soon as official report cards are locked (Integration required: SMS Gateway)</div>
                </div>
                <span className="badge badge-warning">Simulated in Demo</span>
              </div>
            </div>
          </div>
        )}

        {/* Right Panel: Quick Setup Stepper & Activities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Setup Stepper */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Setup</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Examination Details</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>Name, type, dates and applicable classes</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Select Subjects</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>Choose subjects and set maximum marks</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFFBEB', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Marking Configuration</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>Internal / External marks, total marks</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>4</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Publish & Notify</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>Make it active and notify teachers</div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', marginTop: '6px' }}
                onClick={() => setShowCreateModal(true)}
              >
                Launch Setup Wizard
              </button>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Activities</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
              <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <strong>Half Yearly Examination</strong>
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>Ongoing</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Started 3 days ago</div>
              </div>

              <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <strong>Unit Test 1</strong>
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>Completed</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Results published to parents</div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Create Examination Stepper Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create School Examination (Step {wizardStep} of 2)</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} color="#64748B" /></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {wizardStep === 1 ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Examination Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Unit Test 3 / Annual Exam"
                        value={newExam.name}
                        onChange={(e) => setNewExam({ ...newExam, name: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                      />
                    </div>

                    <div className="grid-2-col" style={{ gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Exam Type</label>
                        <select
                          value={newExam.type}
                          onChange={(e) => setNewExam({ ...newExam, type: e.target.value as any })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                        >
                          <option>Unit Test</option>
                          <option>Term Exam</option>
                          <option>Pre-Final</option>
                          <option>Final</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Applicable Classes</label>
                        <input
                          type="text"
                          value={newExam.classes}
                          onChange={(e) => setNewExam({ ...newExam, classes: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '12px', background: '#ECFDF5', borderRadius: '8px', fontSize: '12.5px', color: '#047857' }}>
                      Configure max marks for subjects. By default, theory max marks is set to 80 and internal to 20 (Total: 100).
                    </div>
                    <div className="grid-2-col" style={{ gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Start Date</label>
                        <input
                          type="date"
                          value={newExam.startDate}
                          onChange={(e) => setNewExam({ ...newExam, startDate: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>End Date</label>
                        <input
                          type="date"
                          value={newExam.endDate}
                          onChange={(e) => setNewExam({ ...newExam, endDate: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                {wizardStep === 1 ? (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={() => setWizardStep(2)}>Next: Subjects & Marks →</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
                    <button type="submit" className="btn btn-primary">Publish Examination</button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Building,
  Mail,
  Phone,
  Calendar,
  Globe,
  Save,
  RotateCcw,
  Download,
  Shield,
  Bell,
  CheckCircle2,
  Lock,
  Layers,
  CreditCard,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadJSON } from '../../utils/demoActions';
import { api } from '../../api/client';
import {
  getStoredInstitutionSettings,
  saveStoredInstitutionSettings
} from '../../utils/storage';

export const InstitutionSettingsPage: React.FC = () => {
  const { showToast, setInstitutionName, activeInstitutionId, institutionName } = useApp();
  const [activeTab, setActiveTab] = useState<'General' | 'Academic' | 'Tuition Fees' | 'System Preferences' | 'Backup'>('General');
  const [isSaved, setIsSaved] = useState(false);

  // Load persistent settings
  const stored = getStoredInstitutionSettings();

  // General Form States
  const [name, setName] = useState<string>(stored.name || 'Sri Sai Tuition Center');
  const [shortName, setShortName] = useState<string>(stored.shortName || 'Sri Sai');
  const [tagline, setTagline] = useState<string>(stored.tagline || 'Learn Today, Excel Tomorrow');
  const [description, setDescription] = useState<string>(
    stored.description || 'Quality coaching and personalized academic mentorship for school and board examinations.'
  );
  const [phone, setPhone] = useState<string>(stored.phone || '98765 43210');
  const [email, setEmail] = useState<string>(stored.email || 'srisai.tuition@gmail.com');
  const [website, setWebsite] = useState<string>(stored.website || 'https://www.srisaituition.com');
  const [address, setAddress] = useState<string>(
    stored.address || 'Plot No. 12, Main Road, Hanamkonda, Warangal, Telangana - 506001, India'
  );
  const [currency, setCurrency] = useState<string>(stored.currency || 'INR (₹)');
  const [academicYear, setAcademicYear] = useState<string>(stored.academicYear || '2026 - 2027');

  // Academic Settings
  const [passingPercentage, setPassingPercentage] = useState<number>(stored.passingPercentage || 40);
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(stored.attendanceThreshold || 75);
  const [termCount, setTermCount] = useState<number>(stored.termCount || 2);

  // Fees Settings
  const [feeReceiptPrefix, setFeeReceiptPrefix] = useState<string>(stored.feeReceiptPrefix || 'REC-2026-');
  const [defaultDueDays, setDefaultDueDays] = useState<number>(stored.defaultDueDays || 10);
  const [allowPartialPayments, setAllowPartialPayments] = useState<boolean>(stored.allowPartialPayments ?? true);

  // System Notifications
  const [attendanceAlerts, setAttendanceAlerts] = useState<boolean>(stored.attendanceAlerts ?? true);
  const [testResultAlerts, setTestResultAlerts] = useState<boolean>(stored.testResultAlerts ?? true);
  const [feeReminders, setFeeReminders] = useState<boolean>(stored.feeReminders ?? true);

  useEffect(() => {
    api.settings.get(activeInstitutionId).then((res) => {
      if (res && res.settings) {
        const s = res.settings;
        if (s.name) setName(s.name);
        if (s.shortName) setShortName(s.shortName);
        if (s.tagline) setTagline(s.tagline);
        if (s.description) setDescription(s.description);
        if (s.phone) setPhone(s.phone);
        if (s.email) setEmail(s.email);
        if (s.website) setWebsite(s.website);
        if (s.address) setAddress(s.address);
        if (s.currency) setCurrency(s.currency);
        if (s.academicYear) setAcademicYear(s.academicYear);
        if (s.passingPercentage !== undefined) setPassingPercentage(s.passingPercentage);
        if (s.attendanceThreshold !== undefined) setAttendanceThreshold(s.attendanceThreshold);
        if (s.termCount !== undefined) setTermCount(s.termCount);
        if (s.feeReceiptPrefix) setFeeReceiptPrefix(s.feeReceiptPrefix);
        if (s.defaultDueDays !== undefined) setDefaultDueDays(s.defaultDueDays);
        if (s.allowPartialPayments !== undefined) setAllowPartialPayments(s.allowPartialPayments);
        if (s.attendanceAlerts !== undefined) setAttendanceAlerts(s.attendanceAlerts);
        if (s.testResultAlerts !== undefined) setTestResultAlerts(s.testResultAlerts);
        if (s.feeReminders !== undefined) setFeeReminders(s.feeReminders);
      }
    }).catch(() => {});
  }, [activeInstitutionId]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      showToast('Institution name is required', 'error');
      return;
    }

    const newSettings = {
      ...stored,
      name: name.trim(),
      shortName: shortName.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      address: address.trim(),
      currency,
      academicYear,
      passingPercentage,
      attendanceThreshold,
      termCount,
      feeReceiptPrefix: feeReceiptPrefix.trim(),
      defaultDueDays,
      allowPartialPayments,
      attendanceAlerts,
      testResultAlerts,
      feeReminders
    };

    const previousStoredSettings = getStoredInstitutionSettings();
    const previousInstitutionName = institutionName;

    // Optimistically update screen immediately
    saveStoredInstitutionSettings(newSettings);
    if (setInstitutionName) {
      setInstitutionName(name.trim());
    }
    setIsSaved(true);
    showToast('Institution settings saved and persisted successfully!', 'success');

    // Background server call
    api.settings.update(activeInstitutionId, newSettings).catch(err => {
      if (err instanceof Error && err.name === 'AbortError') return;
      // Rollback on failure
      saveStoredInstitutionSettings(previousStoredSettings);
      if (setInstitutionName) {
        setInstitutionName(previousInstitutionName);
      }
      setIsSaved(false);
      showToast(err instanceof Error ? err.message : 'Failed to sync settings with server', 'error', {
        label: 'Retry',
        onClick: () => {
          handleSave();
        }
      });
    });
  };

  const handleResetDefaults = () => {
    setName('Sri Sai Tuition Center');
    setShortName('Sri Sai');
    setTagline('Learn Today, Excel Tomorrow');
    setPhone('98765 43210');
    setEmail('srisai.tuition@gmail.com');
    setAddress('Plot No. 12, Main Road, Hanamkonda, Warangal, Telangana - 506001, India');
    setCurrency('INR (₹)');
    setPassingPercentage(40);
    setAttendanceThreshold(75);
    setIsSaved(false);
    showToast('Reset form to initial defaults. Click Save to persist.', 'info');
  };

  const handleDownloadBackup = () => {
    const backupData = {
      institution: {
        name,
        shortName,
        tagline,
        description,
        phone,
        email,
        website,
        address,
        currency,
        academicYear
      },
      academic: {
        passingPercentage,
        attendanceThreshold,
        termCount
      },
      fees: {
        feeReceiptPrefix,
        defaultDueDays,
        allowPartialPayments
      },
      notifications: {
        attendanceAlerts,
        testResultAlerts,
        feeReminders
      },
      exportedAt: new Date().toISOString(),
      platform: 'Tutorly Tuition Management'
    };
    downloadJSON(`Tutorly_Backup_${name.replace(/\s+/g, '_')}.json`, backupData);
    showToast('Downloaded full institution configuration JSON backup', 'success');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '13px',
    color: '#0F172A',
    backgroundColor: '#FFFFFF'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#334155',
    display: 'block',
    marginBottom: '4px'
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div className="breadcrumb-nav">
            <span>Admin Portal</span>
            <span>›</span>
            <span>Settings</span>
          </div>
          <h1>Institution Settings</h1>
          <p>Configure institution branding, academic terms, fee receipt defaults, and administrative policies.</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleResetDefaults}>
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>
          <button className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`} onClick={() => handleSave()}>
            {isSaved ? <Check size={15} color="#10B981" /> : <Save size={15} />}
            <span>{isSaved ? 'Settings Saved' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['General', 'Academic', 'Tuition Fees', 'System Preferences', 'Backup'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab(tab);
              setIsSaved(false);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: General & Contact Information */}
      {activeTab === 'General' && (
        <div className="grid-split-balanced">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Institution Brand Card */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building size={18} color="#4F46E5" />
                  <div className="card-title">Institution Profile</div>
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Institution Name *</label>
                  <input
                    type="text"
                    required
                    style={inputStyle}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Short Code / Display Name</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={shortName}
                      onChange={(e) => {
                        setShortName(e.target.value);
                        setIsSaved(false);
                      }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Tagline / Motto</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={tagline}
                      onChange={(e) => {
                        setTagline(e.target.value);
                        setIsSaved(false);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>About / Description</label>
                  <textarea
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Address Card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Campus & Center Address</div>
              </div>
              <div className="card-body">
                <label style={labelStyle}>Physical Address</label>
                <textarea
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setIsSaved(false);
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Contact Details Card */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Phone size={18} color="#4F46E5" />
                  <div className="card-title">Contact Information</div>
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Official Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    style={inputStyle}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Administrative Email *</label>
                  <input
                    type="email"
                    required
                    style={inputStyle}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Website URL</label>
                  <input
                    type="url"
                    style={inputStyle}
                    value={website}
                    onChange={(e) => {
                      setWebsite(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Currency & Locale Card */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Globe size={18} color="#4F46E5" />
                  <div className="card-title">Regional Defaults</div>
                </div>
              </div>

              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Standard Operating Currency</label>
                  <select
                    style={inputStyle}
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      setIsSaved(false);
                    }}
                  >
                    <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                    <option value="USD ($)">USD ($) - US Dollar</option>
                    <option value="AED (د.إ)">AED (د.إ) - UAE Dirham</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Active Academic Session</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={academicYear}
                    onChange={(e) => {
                      setAcademicYear(e.target.value);
                      setIsSaved(false);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Academic Defaults */}
      {activeTab === 'Academic' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} color="#4F46E5" />
              <div className="card-title">Academic Standards & Benchmarks</div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="grid-2-col" style={{ gap: '16px' }}>
              <div>
                <label style={labelStyle}>Minimum Passing Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  style={inputStyle}
                  value={passingPercentage}
                  onChange={(e) => {
                    setPassingPercentage(Number(e.target.value) || 40);
                    setIsSaved(false);
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  Used to calculate pass/fail status in School Examinations and Tuition Tests.
                </span>
              </div>

              <div>
                <label style={labelStyle}>Minimum Attendance Threshold (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  style={inputStyle}
                  value={attendanceThreshold}
                  onChange={(e) => {
                    setAttendanceThreshold(Number(e.target.value) || 75);
                    setIsSaved(false);
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  Students falling below this threshold are marked "Needs Attention".
                </span>
              </div>
            </div>

            <div className="grid-2-col" style={{ gap: '16px' }}>
              <div>
                <label style={labelStyle}>Annual Evaluation Terms</label>
                <select
                  style={inputStyle}
                  value={termCount}
                  onChange={(e) => {
                    setTermCount(Number(e.target.value) || 2);
                    setIsSaved(false);
                  }}
                >
                  <option value={2}>2 Terms (Term 1 & Term 2)</option>
                  <option value={3}>3 Trimesters</option>
                  <option value={4}>4 Quarters</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Active Academic Year</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setIsSaved(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tuition Fees Settings */}
      {activeTab === 'Tuition Fees' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={18} color="#4F46E5" />
              <div className="card-title">Fee Management Defaults</div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="grid-2-col" style={{ gap: '16px' }}>
              <div>
                <label style={labelStyle}>Receipt Number Prefix</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={feeReceiptPrefix}
                  onChange={(e) => {
                    setFeeReceiptPrefix(e.target.value);
                    setIsSaved(false);
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  Prefix attached to all auto-generated payment receipts (e.g. REC-2026-001).
                </span>
              </div>

              <div>
                <label style={labelStyle}>Default Due Window (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  style={inputStyle}
                  value={defaultDueDays}
                  onChange={(e) => {
                    setDefaultDueDays(Number(e.target.value) || 10);
                    setIsSaved(false);
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  Number of grace days after admission or start of month before dues become pending.
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowPartialPayments}
                  onChange={(e) => {
                    setAllowPartialPayments(e.target.checked);
                    setIsSaved(false);
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>Allow Partial Tuition Fee Installments</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Permits recording partial payments with automatic remaining balance tracking without clearing the status prematurely.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System Preferences & Notifications */}
      {activeTab === 'System Preferences' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} color="#4F46E5" />
              <div className="card-title">Automated Event Alerts & Triggers</div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={attendanceAlerts}
                onChange={(e) => {
                  setAttendanceAlerts(e.target.checked);
                  setIsSaved(false);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>Daily Absence Notifications</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>Trigger automated alert flags when a student is marked Absent during daily attendance register save.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={testResultAlerts}
                onChange={(e) => {
                  setTestResultAlerts(e.target.checked);
                  setIsSaved(false);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>Exam & Test Results Publishing Notifications</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>Generate performance report cards when exam marks are saved.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={feeReminders}
                onChange={(e) => {
                  setFeeReminders(e.target.checked);
                  setIsSaved(false);
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>Tuition Fee Due Reminders</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>Highlight overdue and pending student balances on the dashboard.</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Tab 5: Data & Backup */}
      {activeTab === 'Backup' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={18} color="#4F46E5" />
              <div className="card-title">System Data Backup & Export</div>
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.4 }}>
              Download a full JSON backup of the current Tutorly operational database, including institution settings, academic calendars, exams, tuition tests, and fee records.
            </p>

            <div style={{ padding: '16px', background: '#EEF2FF', borderRadius: '8px', border: '1px solid #C7D2FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#4338CA' }}>Complete System Snapshot</div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>Format: JSON • Ready for disaster recovery or migration</div>
              </div>
              <button className="btn btn-primary" onClick={handleDownloadBackup}>
                <Download size={15} />
                <span>Download Backup JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

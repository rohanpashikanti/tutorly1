import React, { useState } from 'react';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LoginPage: React.FC = () => {
  const { isLoggedIn, hasMembership, currentRoute, currentUser, login, register, createInstitution } = useApp();
  const onboarding = isLoggedIn && (!hasMembership || currentRoute === 'onboarding');
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (onboarding) await createInstitution(institutionName);
      else if (isRegistering) await register(name, email, password);
      else await login(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="login-card-container">
        <div className="login-hero-panel">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}><GraduationCap size={24} /></div>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>Tutorly</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '16px' }}>Simplify Your <br />Tuition Center <br />Management</h1>
            <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.6, maxWidth: '420px', marginBottom: '28px' }}>Manage students, teachers, attendance, examinations, tuition tests, fees and more — all in one unified platform.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
              {[{ icon: <Users size={15} color="#6366F1" />, text: 'Organize with Ease' }, { icon: <BarChart3 size={15} color="#10B981" />, text: 'Track Progress' }, { icon: <ShieldCheck size={15} color="#F59E0B" />, text: 'Keep Parents Informed' }].map((item) => <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '9999px', border: '1px solid #E2E8F0', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{item.icon}<span>{item.text}</span></div>)}
            </div>
          </div>
          <div style={{ background: '#FFFFFF', padding: '18px 22px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} color="#6366F1" /></div><div><div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Tutorly</div><div style={{ fontSize: '11px', color: '#64748B' }}>Tuition center management</div></div></div>
            <p style={{ fontSize: '12.5px', color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>“Manage learning and center operations in one place.”</p>
          </div>
        </div>

        <div className="login-form-panel">
          {onboarding ? (
            <>
              <div style={{ marginBottom: '28px' }}><h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Create a Tuition Institution</h2><p style={{ fontSize: '13.5px', color: '#64748B' }}>Signed in as {currentUser.email}. Your account will own this new institution.</p></div>
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Institution name<input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} required minLength={2} maxLength={160} autoComplete="organization" style={inputStyle} /></label>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>A new institution is created empty. Existing demo records are not imported.</p>
                <button type="submit" disabled={busy} className="btn btn-primary" style={buttonStyle}>{busy ? 'Creating…' : 'Create Institution'}<ArrowRight size={16} /></button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '28px' }}><h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>{isRegistering ? 'Create Your Account' : 'Welcome Back'}</h2><p style={{ fontSize: '13.5px', color: '#64748B' }}>{isRegistering ? 'Register an account to start institution setup.' : 'Sign in to your Tutorly account'}</p></div>
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {isRegistering && <label style={labelStyle}>Full name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" style={inputStyle} /></label>}
                <label style={labelStyle}>Email Address<div style={{ position: 'relative' }}><Mail size={16} style={iconStyle} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" style={{ ...inputStyle, paddingLeft: '38px' }} /></div></label>
                <label style={labelStyle}>Password<div style={{ position: 'relative' }}><Lock size={16} style={iconStyle} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={isRegistering ? 'new-password' : 'current-password'} style={{ ...inputStyle, paddingLeft: '38px', paddingRight: '38px' }} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={eyeButtonStyle}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                {error && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: '13px' }}>{error}</p>}
                <button type="submit" disabled={busy} className="btn btn-primary" style={buttonStyle}>{busy ? 'Please wait…' : isRegistering ? 'Create Account' : 'Sign In'}<ArrowRight size={16} /></button>
              </form>
              <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '13px', color: '#64748B' }}>{isRegistering ? 'Already registered?' : 'New to Tutorly?'}{' '}<button type="button" onClick={() => { setError(''); setIsRegistering(!isRegistering); }} style={{ color: '#4F46E5', fontWeight: 700, background: 'none', border: 0, cursor: 'pointer' }}>{isRegistering ? 'Sign in' : 'Create an account'}</button></div>
              {!isRegistering && <p style={{ marginTop: '18px', fontSize: '12px', textAlign: 'center', color: '#64748B' }}>Password reset and email verification become available after email delivery is configured.</p>}
            </>
          )}
          {error && onboarding && <p role="alert" style={{ marginTop: '16px', color: '#B91C1C', fontSize: '13px' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '0' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: '6px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', outline: 'none', fontSize: '13.5px', background: '#F8FAFC', boxSizing: 'border-box' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14.5px', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const iconStyle: React.CSSProperties = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' };
const eyeButtonStyle: React.CSSProperties = { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', background: 'none', border: 0, cursor: 'pointer' };

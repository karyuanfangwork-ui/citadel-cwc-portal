import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── Shared brand panel ────────────────────────────────────────── */
const brandPanelStyle: React.CSSProperties = {
  width: '400px',
  flexShrink: 0,
  minHeight: '100vh',
  background: 'linear-gradient(160deg, var(--color-brand-900) 0%, var(--color-brand-700) 100%)',
  padding: 'var(--space-10) var(--space-8)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'relative',
  overflow: 'hidden',
};

const BrandPanel = ({
  headline,
  descriptor,
}: {
  headline: React.ReactNode;
  descriptor: string;
}) => (
  <div style={brandPanelStyle}>
    {/* Decorative circles */}
    <div style={{
      position: 'absolute', top: '-60px', right: '-60px',
      width: '200px', height: '200px', borderRadius: '50%',
      background: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute', bottom: '-50px', left: '-40px',
      width: '160px', height: '160px', borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
    }} />

    {/* Top section: logo + headline + descriptor + desk cards */}
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Logo row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-10)' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>corporate_fare</span>
        </div>
        <span style={{
          fontSize: 'var(--text-sm)', fontWeight: 800, color: '#fff', letterSpacing: '0.5px',
        }}>HELP CENTER</span>
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff',
        lineHeight: 1.15, marginBottom: 'var(--space-3)',
      }}>{headline}</h1>

      {/* Descriptor */}
      <p style={{
        fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.6, marginBottom: 'var(--space-8)',
      }}>{descriptor}</p>

      {/* Desk cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {[
          { icon: 'devices',  bg: 'rgba(0,82,204,0.35)',   name: 'IT Support',     desc: 'Hardware, software & access requests' },
          { icon: 'groups',   bg: 'rgba(5,150,105,0.35)',  name: 'HR Services',    desc: 'Leave, onboarding & people requests' },
          { icon: 'payments', bg: 'rgba(217,119,6,0.35)',  name: 'Group Finance',  desc: 'Reimbursements & payment requests' },
        ].map(({ icon, bg, name, desc }) => (
          <div key={name} style={{
            background: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
              background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '16px' }}>{icon}</span>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>{name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Footer */}
    <div style={{ position: 'relative', zIndex: 1 }}>
      <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.35)' }}>
        © 2026 CWC Enterprise Help Center
      </p>
    </div>
  </div>
);

/* ─── Input with optional icon ─────────────────────────────────── */
const FormInput = ({
  id, name, type, label, icon, autoComplete, required, value, onChange, placeholder,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  icon?: string;
  autoComplete?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={{
        display: 'block',
        fontSize: 'var(--text-xs)', fontWeight: 700,
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-1)',
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '18px', color: 'var(--color-text-tertiary)', pointerEvents: 'none',
          }}>{icon}</span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: icon ? '11px 14px 11px 40px' : '11px 14px',
            border: focused
              ? '1.5px solid var(--color-brand-700)'
              : '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: focused ? 'var(--color-surface)' : 'var(--color-surface-subtle)',
            boxShadow: focused ? '0 0 0 3px var(--color-brand-100)' : 'none',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
          }}
        />
      </div>
    </div>
  );
};

/* ─── Login page ────────────────────────────────────────────────── */
const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <BrandPanel
        headline={<>Your enterprise<br /><span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>support hub.</span></>}
        descriptor="One place for IT, HR, and Finance requests. Get help fast, track your requests, and stay informed."
      />

      {/* Form panel */}
      <div style={{
        flex: 1,
        background: 'var(--color-surface)',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12)',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 900,
            color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)',
          }}>Welcome back</h2>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
          }}>
            Sign in to continue ·{' '}
            <Link to="/register" style={{ color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}>
              Create an account
            </Link>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)', color: 'var(--color-danger)',
              }}>{error}</div>
            )}

            <FormInput
              id="email" name="email" type="email" label="Email address"
              icon="mail" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <FormInput
              id="password" name="password" type="password" label="Password"
              icon="lock" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading
                  ? 'var(--color-brand-700)'
                  : 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: 800,
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.15s, transform 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.opacity = '0.92'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = loading ? '0.5' : '1'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <span style={{
                    display: 'inline-block', width: '14px', height: '14px',
                    border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  Signing in...
                </span>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Demo credentials box */}
          <div style={{
            marginTop: 'var(--space-6)',
            background: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <div style={{
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: 'var(--space-2)',
            }}>Demo Credentials</div>
            {[
              { role: 'Admin', email: 'admin@helpdesk.com', pass: 'admin123' },
              { role: 'Agent', email: 'agent@helpdesk.com', pass: 'agent123' },
              { role: 'User',  email: 'user@helpdesk.com',  pass: 'user123'  },
            ].map(({ role, email: demoEmail, pass }) => (
              <div key={role} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 'var(--space-1)',
              }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{role}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                  color: 'var(--color-brand-700)', background: 'var(--color-brand-50)',
                  borderRadius: '4px', padding: '2px 7px',
                }}>{demoEmail} / {pass}</span>
              </div>
            ))}
          </div>

          {/* Spinner keyframe — injected once */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
};

export default Login;

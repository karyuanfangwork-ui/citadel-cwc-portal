import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import citadelLogo from '../assets/citadel-logo-mark.svg';

/* ─── Module spotlight data ─────────────────────────────────────── */
interface Module {
  icon: string;
  name: string;
  desc: string;
  color: string;
}

const MODULES: Module[] = [
  { icon: 'devices',    name: 'IT Support',       desc: 'Hardware, software & access requests', color: '#60a5fa' },
  { icon: 'groups',     name: 'Group HR',          desc: 'Leave, onboarding & people requests',  color: '#34d399' },
  { icon: 'payments',   name: 'Group Finance',     desc: 'Reimbursements & payment requests',    color: '#f59e0b' },
  { icon: 'handshake',  name: 'CRM',               desc: 'Customer relationship management',     color: '#a78bfa' },
  { icon: 'monitoring', name: 'Credit Assessment', desc: 'Risk scoring & credit decisions',      color: '#f87171' },
];

/* ─── Module spotlight component ───────────────────────────────── */
const ModuleSpotlight: React.FC = () => {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setActive(prev => (prev + 1) % MODULES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const current = MODULES[active];
  const rest = MODULES.filter((_, i) => i !== active);

  return (
    <div style={{ zIndex: 1 }}>
      {/* Dot progress bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {MODULES.map((m, i) => (
          <div
            key={m.name}
            style={{
              height: '4px',
              borderRadius: '2px',
              background: i === active ? m.color : 'rgba(255,255,255,0.2)',
              width: i === active ? '32px' : '20px',
              transition: 'width 0.3s, background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Spotlight card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '12px',
          opacity: 1,
          transition: 'opacity 0.3s',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '22px', color: current.color, display: 'block', marginBottom: '6px' }}
        >
          {current.icon}
        </span>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: current.color, marginBottom: '3px' }}>
          {current.name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)' }}>
          {current.desc}
        </div>
      </div>

      {/* Mini list — remaining modules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {rest.map(m => (
          <div
            key={m.name}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)',
              paddingBottom: '5px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.color + '88', flexShrink: 0 }} />
            {m.name}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Shared brand panel ────────────────────────────────────────── */
const brandPanelStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)',
  padding: 'var(--space-10) var(--space-8)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'relative',
  overflow: 'hidden',
};

const BrandPanel = () => (
  <div style={brandPanelStyle} className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen">
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

    <div style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Citadel logo lockup ── */}
      <div style={{ marginBottom: 'var(--space-10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <img src={citadelLogo} alt="Citadel logo mark" style={{ width: '44px', height: '44px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff', letterSpacing: '1.5px', lineHeight: 1 }}>CITADEL</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '2px', marginTop: '2px' }}>WORKPLACE CONNECT</div>
          </div>
        </div>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(96,165,250,0.4) 0%, rgba(255,255,255,0.05) 100%)', marginTop: 'var(--space-3)' }} />
      </div>

      <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 'var(--space-3)' }}>Get started with<br /><span style={{ color: '#60a5fa', fontWeight: 700 }}>CWC.</span></h1>
      <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 'var(--space-8)' }}>Create your account to submit and track requests across every module.</p>

      {/* Module spotlight */}
      <ModuleSpotlight />
    </div>

    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: 'var(--space-3)' }} />
      <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
      © 2026 Citadel Group Technologies Sdn Bhd
      Citadel Workplace Connect · All rights reserved
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

/* ─── Register page ─────────────────────────────────────────────── */
const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    department: '',
    jobTitle: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['var(--color-danger)', 'var(--color-warning)', '#f59e0b', 'var(--color-brand-500)', 'var(--color-success)'];
    return { score, label: labels[score], color: colors[score] };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department || undefined,
        jobTitle: formData.jobTitle || undefined,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <BrandPanel />

      {/* Form panel — align-items flex-start so long form starts near top */}
      <div className="flex-1 flex md:items-start justify-center p-6 md:p-10 md:px-12" style={{
        background: 'var(--color-surface)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* CWC sub-brand badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
            <img src={citadelLogo} alt="Citadel" style={{ width: '28px', height: '28px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-brand-700)', letterSpacing: '0.8px' }}>CITADEL</div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '1.5px', marginTop: '1px' }}>WORKPLACE CONNECT</div>
            </div>
          </div>

          <h2 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 900,
            color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)',
          }}>Create your account</h2>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-brand-500)', fontWeight: 700, textDecoration: 'none' }}>
              Sign in
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

            {/* Row 1: First + Last Name */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-3)' }}>
              <FormInput id="firstName" name="firstName" type="text" label="First Name" required value={formData.firstName} onChange={handleChange} />
              <FormInput id="lastName"  name="lastName"  type="text" label="Last Name"  required value={formData.lastName}  onChange={handleChange} />
            </div>

            {/* Row 2: Email */}
            <FormInput id="email" name="email" type="email" label="Email address" icon="mail" autoComplete="email" required value={formData.email} onChange={handleChange} />

            {/* Row 3: Password */}
            <div>
              <FormInput id="password" name="password" type="password" label="Password" icon="lock" required value={formData.password} onChange={handleChange} placeholder="At least 8 characters" />
              {formData.password && (
                <div style={{ marginTop: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${(passwordStrength.score / 5) * 100}%`, height: '100%', background: passwordStrength.color, transition: 'width 0.2s, background 0.2s' }} />
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color, fontWeight: 600, minWidth: '60px' }}>{passwordStrength.label}</span>
                </div>
              )}
            </div>

            {/* Row 4: Confirm Password */}
            <FormInput id="confirmPassword" name="confirmPassword" type="password" label="Confirm Password" icon="lock" required value={formData.confirmPassword} onChange={handleChange} />

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-2) 0 var(--space-5)' }} />

            {/* Row 5: Department + Job Title (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-3)' }}>
              <FormInput
                id="department" name="department" type="text"
                label="Department"
                value={formData.department} onChange={handleChange}
              />
              <FormInput
                id="jobTitle" name="jobTitle" type="text"
                label="Job Title"
                value={formData.jobTitle} onChange={handleChange}
              />
            </div>
            {/* Optional hint below the grid */}
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'calc(var(--space-1) * -1)' }}>
              Department and Job Title are optional.
            </p>

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
                  Creating account...
                </span>
              ) : 'Create account →'}
            </button>
          </form>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
};

export default Register;

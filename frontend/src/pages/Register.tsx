import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── Shared brand panel (copy from Login — identical markup) ───── */
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-10)' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>corporate_fare</span>
        </div>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>HELP CENTER</span>
      </div>

      <h1 style={{
        fontSize: 'var(--text-3xl)', fontWeight: 900, color: '#fff',
        lineHeight: 1.15, marginBottom: 'var(--space-3)',
      }}>{headline}</h1>

      <p style={{
        fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.6, marginBottom: 'var(--space-8)',
      }}>{descriptor}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {[
          { icon: 'devices',  bg: 'rgba(0,82,204,0.35)',   name: 'IT Support',    desc: 'Hardware, software & access requests' },
          { icon: 'groups',   bg: 'rgba(5,150,105,0.35)',  name: 'HR Services',   desc: 'Leave, onboarding & people requests' },
          { icon: 'payments', bg: 'rgba(217,119,6,0.35)',  name: 'Group Finance', desc: 'Reimbursements & payment requests' },
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
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <BrandPanel
        headline={<>Join your team on<br /><span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>Help Center.</span></>}
        descriptor="Create your account to start raising requests across IT, HR, and Finance — and track them in real time."
      />

      {/* Form panel — align-items flex-start so long form starts near top */}
      <div style={{
        flex: 1,
        background: 'var(--color-surface)',
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'var(--space-10) var(--space-12)',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)', fontWeight: 900,
            color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)',
          }}>Create your account</h2>
          <p style={{
            fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-brand-700)', fontWeight: 700, textDecoration: 'none' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
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

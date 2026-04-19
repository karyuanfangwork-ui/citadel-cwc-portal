# Login & Register Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Login and Register pages from generic centered-card layouts to a split-panel design with a 400px brand panel on the left and a scrollable form panel on the right, using the existing token system.

**Architecture:** Both pages share an identical brand panel (gradient, logo, headline, 3 desk cards, footer) and differ only in headline text and form content. All auth logic (`login()`, `register()`, `useAuth()`) is unchanged — only the JSX and inline styles change. No new dependencies.

**Tech Stack:** React 19 + TypeScript, inline styles using CSS custom properties from `frontend/src/styles/tokens.css`, Material Symbols Outlined icons, React Router v7 (`Link`, `useNavigate`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/pages/Login.tsx` | **REWRITE** | Split panel login: brand panel + email/password form + demo credentials box |
| `frontend/src/pages/Register.tsx` | **REWRITE** | Split panel register: same brand panel + 7-field form with grid rows and divider |

---

## Token Reference

These are the CSS custom properties available in `frontend/src/styles/tokens.css`. Use `var(--token-name)` in inline styles:

```
--color-brand-900: #0747a6   (darkest brand, used in gradient start)
--color-brand-700: #0052cc   (primary brand)
--color-brand-500: #0065ff   (lighter brand, gradient end)
--color-brand-100: #cce0ff   (focus ring color)
--color-brand-50:  #e6f0ff   (badge background)

--color-surface:         #ffffff
--color-surface-subtle:  #f8fafc
--color-border:          #e2e8f0
--color-text-primary:    #111827
--color-text-secondary:  #6b7280
--color-text-tertiary:   #9ca3af
--color-danger:          #dc2626

--color-it-500:  #0052cc    (IT desk icon bg tint: rgba(0,82,204,0.35))
--color-hr-500:  #059669    (HR desk icon bg tint: rgba(5,150,105,0.35))
--color-fin-500: #d97706    (Finance desk icon bg tint: rgba(217,119,6,0.35))

--space-1: 4px   --space-2: 8px    --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px   --space-8: 32px  --space-10: 40px
--space-12: 48px

--radius-sm: 6px   --radius-md: 8px   --radius-lg: 12px

--text-xs: 0.75rem   --text-sm: 0.875rem   --text-2xl: 1.5rem   --text-3xl: 1.875rem

--font-sans: 'Plus Jakarta Sans', sans-serif
--font-mono: 'JetBrains Mono', monospace
```

---

### Task 1: Rewrite Login.tsx

**Files:**
- Modify: `frontend/src/pages/Login.tsx` (full rewrite)

This task has no unit-testable logic to test first — all auth logic already exists. The verification step is a visual browser check.

- [ ] **Step 1: Replace Login.tsx with the split-panel implementation**

Replace the entire contents of `frontend/src/pages/Login.tsx` with:

```tsx
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
```

- [ ] **Step 2: Start the dev server and verify Login visually**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/#/login` in a browser.

Expected:
- Left: 400px dark blue gradient panel with HELP CENTER logo, "Your enterprise support hub." headline (second line muted), descriptor text, 3 desk cards (IT/HR/Finance with tinted icon backgrounds), footer
- Right: white panel, "Welcome back" heading, subtext with "Create an account" link, email field with mail icon, password field with lock icon, "Sign in →" gradient button, demo credentials box with 3 rows (Admin/Agent/User) in mono badge style
- Focus any input → blue border + ring appears
- Hover button → slight lift (translateY(-1px))
- Submit with wrong credentials → error banner appears above email field

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat: redesign Login page with split-panel layout and token-based styles"
```

---

### Task 2: Rewrite Register.tsx

**Files:**
- Modify: `frontend/src/pages/Register.tsx` (full rewrite)

- [ ] **Step 1: Replace Register.tsx with the split-panel implementation**

Replace the entire contents of `frontend/src/pages/Register.tsx` with:

```tsx
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
            <FormInput id="password" name="password" type="password" label="Password" icon="lock" required value={formData.password} onChange={handleChange} placeholder="At least 8 characters" />

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
```

- [ ] **Step 2: Verify Register visually**

Navigate to `http://localhost:5173/#/register` in the browser (dev server already running from Task 1).

Expected:
- Same brand panel on the left (headline now reads "Join your team on Help Center." with second line muted)
- Right panel: "Create your account" heading, "Already have an account? Sign in" subtext
- First Name + Last Name in a 2-column grid
- Email with mail icon, Password with lock icon, Confirm Password with lock icon
- Horizontal divider line, then Department + Job Title in a 2-column grid (with "optional" hint below)
- "Create account →" gradient button
- Submit with mismatched passwords → error "Passwords do not match" appears above first name fields
- Submit with password < 8 chars → error "Password must be at least 8 characters"
- Brand panel fixed in place; if the viewport is short, right panel scrolls independently

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build
```

Expected: exits with code 0, no TypeScript errors. Ignore asset size warnings.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Register.tsx
git commit -m "feat: redesign Register page with split-panel layout and token-based styles"
```

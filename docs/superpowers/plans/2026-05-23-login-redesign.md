# Login Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `Login.tsx` to showcase all 5 platform modules (IT Support, HR Services, Group Finance, CRM, Credit Assessment) via an animated cycling spotlight on the left panel, while keeping the white form panel and all auth logic unchanged.

**Architecture:** All changes are confined to `frontend/src/pages/Login.tsx`. A `MODULES` constant replaces the current hardcoded 3-item array. A new `ModuleSpotlight` sub-component uses `useState` + `useEffect` to cycle the active module index every 2.5 seconds. The `BrandPanel` component renders `ModuleSpotlight` in place of the static desk cards.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Material Symbols (already loaded), inline styles matching existing design token pattern (`var(--color-*)`, `var(--text-*)`, `var(--space-*)`, `var(--radius-*)`).

---

### Task 1: Add MODULES constant and types

**Files:**
- Modify: `frontend/src/pages/Login.tsx` (top of file, after imports)

- [ ] **Step 1: Add the Module type and MODULES array after the existing imports**

Open `frontend/src/pages/Login.tsx`. After the import block (after line `import { useAuth } from '../context/AuthContext';`), insert:

```tsx
interface Module {
  icon: string;
  name: string;
  desc: string;
  color: string;
}

const MODULES: Module[] = [
  { icon: 'devices',    name: 'IT Support',       desc: 'Hardware, software & access requests', color: '#60a5fa' },
  { icon: 'groups',     name: 'HR Services',       desc: 'Leave, onboarding & people requests',  color: '#34d399' },
  { icon: 'payments',   name: 'Group Finance',     desc: 'Reimbursements & payment requests',    color: '#f59e0b' },
  { icon: 'handshake',  name: 'CRM',               desc: 'Customer relationship management',     color: '#a78bfa' },
  { icon: 'monitoring', name: 'Credit Assessment', desc: 'Risk scoring & credit decisions',      color: '#f87171' },
];
```

- [ ] **Step 2: Verify TypeScript compiles with no new errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (existing errors, if any, are pre-existing and can be ignored).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): add MODULES constant with all 5 platform modules"
```

---

### Task 2: Build ModuleSpotlight component

**Files:**
- Modify: `frontend/src/pages/Login.tsx` (add component above `BrandPanel`)

- [ ] **Step 1: Add ModuleSpotlight component above the `BrandPanel` const**

Insert this entire block immediately before the line `const brandPanelStyle: React.CSSProperties = {`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): add ModuleSpotlight component with cycling animation"
```

---

### Task 3: Update BrandPanel to use ModuleSpotlight + update gradient

**Files:**
- Modify: `frontend/src/pages/Login.tsx` — `brandPanelStyle` and `BrandPanel` component body

- [ ] **Step 1: Update the gradient in `brandPanelStyle`**

Find:
```tsx
  background: 'linear-gradient(160deg, #0d1830 0%, #1D2D5E 55%, #2a4a7f 100%)',
```

Replace with:
```tsx
  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)',
```

- [ ] **Step 2: Replace the static desk cards section with `<ModuleSpotlight />`**

Inside `BrandPanel`, find the entire static desk cards block — it starts with the comment `{/* Desk cards */}` and ends with the closing `</div>` of the `.map(...)` block. Replace that entire block (from `{/* Desk cards */}` to its closing `</div>`) with:

```tsx
      {/* Module spotlight */}
      <ModuleSpotlight />
```

- [ ] **Step 3: Update the hero headline and descriptor to reflect all 5 modules**

The `BrandPanel` component receives `headline` and `descriptor` as props from the `Login` component at the bottom of the file. Find the `<BrandPanel ... />` usage in the `Login` return and update:

```tsx
      <BrandPanel
        headline={<>One platform,<br /><span style={{ color: '#60a5fa', fontWeight: 700 }}>every workflow.</span></>}
        descriptor="IT · HR · Finance · CRM · Credit Assessment — all in one place."
      />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): wire ModuleSpotlight into BrandPanel, update gradient and headline"
```

---

### Task 4: Visual QA in browser

**Files:** none — verification only

- [ ] **Step 1: Start the frontend dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser and navigate to the login page (or go directly to `http://localhost:5173/login`).

- [ ] **Step 2: Verify animated cycling**

Confirm:
- The spotlight card cycles through all 5 modules automatically every ~2.5 seconds
- The active dot in the progress bar expands and takes the module's accent color
- The remaining modules appear in the mini list below the spotlight card with their colored dots
- No layout shift occurs during cycling

- [ ] **Step 3: Verify form is unchanged**

Confirm:
- Email and password inputs work
- "Forgot password?" link is present
- Sign In button submits (can use the seed account `admin@test.local` / `abc@123` to test a full login)
- Error state appears on wrong credentials

- [ ] **Step 4: Verify mobile layout**

Resize browser to < 768px width. Confirm:
- Left panel stacks above the form
- `ModuleSpotlight` is visible (it is not hidden on mobile in this design — acceptable since it's not a large block)
- Form is fully usable

- [ ] **Step 5: Commit final QA confirmation**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): redesign complete — animated module spotlight with all 5 modules"
```

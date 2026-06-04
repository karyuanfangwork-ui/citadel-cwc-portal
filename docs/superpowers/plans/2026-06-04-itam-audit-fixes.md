# ITAM Module Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all findings from the 2026-06-04 audit of `frontend/pages/AssetManagement.tsx` — replace hardcoded Tailwind colors with design-system tokens, adopt shared UI primitives (Modal, Drawer, Skeleton, Button, EmptyState), add pagination, fix accessibility, debounce search, parallelize bulk delete, and fix the return-dropdown dismiss bug.

**Architecture:** All changes are confined to `frontend/pages/AssetManagement.tsx` (≈1 300 lines). Each task touches a logically isolated section of the file; tasks are ordered so later tasks build on earlier token/component fixes without conflicts. No new files are created.

**Tech Stack:** React 19, TypeScript, Tailwind v4, shared UI components at `frontend/src/components/ui/` (Modal, Drawer, Skeleton, Button, EmptyState), design tokens via CSS custom properties consumed through Tailwind utility classes (`bg-brand-*`, `text-text-*`, `border-cwc-border`, `rounded-cwc-*`, `shadow-cwc-*`).

---

## File Map

| File | Role |
|---|---|
| `frontend/pages/AssetManagement.tsx` | Only file modified — contains all five sub-components: `AssetManagement`, `AssetRegistryTab`, `EmployeeAssetsTab`, `AssetDetailDrawer`, `AssetFormModal`, `ImportAssetsModal` |
| `frontend/src/components/ui/Modal.tsx` | Read-only reference — `isOpen`, `onClose`, `title`, `size`, `footer` props, renders via portal |
| `frontend/src/components/ui/Drawer.tsx` | Read-only reference — `isOpen`, `onClose`, `title`, `side`, `width` props |
| `frontend/src/components/ui/Button.tsx` | Read-only reference — `variant` (`primary`/`secondary`/`danger`/`ghost`), `size` (`sm`/`md`/`lg`), `loading`, `icon` (Material Symbols name), `type` props |
| `frontend/src/components/ui/EmptyState.tsx` | Read-only reference — `icon` (Material Symbols name string), `title`, `description`, `action` props |
| `frontend/src/components/ui/Skeleton.tsx` | Read-only reference — `className`, `rounded` (`none`/`sm`/`md`/`lg`/`full`) props |

---

## Task 1 — Replace All Hardcoded Colors with Design Tokens

**Context:** Every color in the file (`text-gray-*`, `bg-white`, `border-gray-*`, `bg-blue-*`, `text-blue-*`, `focus:ring-blue-*`, `rounded-lg/xl`, `shadow-xl`) violates the design system. This task sweeps the entire file and is a prerequisite for all other tasks.

**Design-token mapping:**

| Old class | New class |
|---|---|
| `text-gray-900` | `text-text-primary` |
| `text-gray-700` | `text-text-primary` |
| `text-gray-500` | `text-text-secondary` |
| `text-gray-400` | `text-text-tertiary` |
| `text-gray-300` | `text-text-tertiary` |
| `bg-white` (surfaces) | `bg-surface` |
| `bg-gray-50` (hover/muted bg) | `bg-surface-muted` |
| `bg-gray-50/50` | `bg-surface-subtle` |
| `border-gray-200` | `border-cwc-border` |
| `border-gray-300` | `border-cwc-border` |
| `border-gray-100` | `border-cwc-border/50` |
| `divide-gray-200` | `divide-cwc-border` |
| `divide-gray-100` | `divide-cwc-border/50` |
| `bg-blue-600` (primary btn) | `bg-brand-700` |
| `hover:bg-blue-700` | `hover:bg-brand-600` |
| `text-blue-600` (links/active) | `text-brand-600` |
| `bg-blue-50` | `bg-brand-50` |
| `bg-blue-100` | `bg-brand-100` |
| `text-blue-700` | `text-brand-700` |
| `border-blue-500` | `border-brand-500` |
| `border-l-blue-500` | `border-l-brand-500` |
| `focus:ring-blue-500` | `focus:ring-brand-500` |
| `focus:ring-1 focus:ring-blue-500` | `focus-visible:ring-2 focus-visible:ring-brand-500` |
| `rounded-lg` | `rounded-cwc-lg` |
| `rounded-xl` | `rounded-cwc-xl` |
| `shadow-xl` | `shadow-cwc-lg` |
| `shadow-lg` | `shadow-cwc-lg` |
| `bg-amber-600` / `hover:bg-amber-700` | keep (no amber token exists — amber is domain-specific) |
| `bg-red-*` / `text-red-*` / `border-red-*` | keep (semantic danger; no red token defined in design system) |
| `bg-green-*` / `text-green-*` | keep for import result states (no green token in design system) |

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx` (full-file sweep)

- [ ] **Step 1: Replace all gray text tokens**

Open `frontend/pages/AssetManagement.tsx`. Using find-and-replace (not regex — check context for each):

Replace every `text-gray-900` and `text-gray-700` with `text-text-primary`.
Replace every `text-gray-500` with `text-text-secondary`.
Replace every `text-gray-400` and `text-gray-300` with `text-text-tertiary`.

- [ ] **Step 2: Replace background surface tokens**

Replace `bg-white` with `bg-surface` (only on container divs, table bodies, modal panels — not on `<html>`/global).
Replace `bg-gray-50` (used as hover or muted background) with `bg-surface-muted`.
Replace `hover:bg-gray-50` with `hover:bg-surface-muted`.
Replace `bg-gray-50/50` with `bg-surface-subtle`.
Replace `bg-gray-100` (table header) with `bg-surface-muted`.

- [ ] **Step 3: Replace border and divide tokens**

Replace `border-gray-200` with `border-cwc-border`.
Replace `border-gray-300` with `border-cwc-border`.
Replace `border-gray-100` with `border-cwc-border/50`.
Replace `divide-gray-200` with `divide-cwc-border`.
Replace `divide-gray-100` with `divide-cwc-border/50`.

- [ ] **Step 4: Replace blue brand tokens**

Replace `bg-blue-600` with `bg-brand-700`.
Replace `hover:bg-blue-700` with `hover:bg-brand-600`.
Replace `text-blue-600` (links, active tab underline) with `text-brand-600`.
Replace `border-blue-600` with `border-brand-600`.
Replace `bg-blue-50` with `bg-brand-50`.
Replace `bg-blue-100` with `bg-brand-100`.
Replace `text-blue-700` with `text-brand-700`.
Replace `border-l-blue-500` with `border-l-brand-500`.
Replace `focus:ring-blue-500` and `focus:ring-1 focus:ring-blue-500` with `focus-visible:ring-2 focus-visible:ring-brand-500`.

- [ ] **Step 5: Replace border-radius and shadow tokens**

Replace `rounded-lg` with `rounded-cwc-lg`.
Replace `rounded-xl` with `rounded-cwc-xl`.
Replace `rounded` (bare, on small buttons) with `rounded-cwc-md`.
Replace `shadow-xl` and `shadow-lg` with `shadow-cwc-lg`.

- [ ] **Step 6: Replace import-stepper step indicator colors (lines ~1252–1257)**

Locate the step indicator inside `ImportAssetsModal`. Change from:
```tsx
<span className={`px-2 py-0.5 rounded ${
  phase === 'upload' && i === 0 ? 'bg-blue-600 text-white' :
  phase === 'preview' && i === 1 ? 'bg-blue-600 text-white' :
  phase === 'result' && i === 2 ? 'bg-green-600 text-white' :
  'bg-gray-100 text-gray-400'
}`}>{step}</span>
```
Change to:
```tsx
<span className={`px-2 py-0.5 rounded-cwc-md text-xs font-medium ${
  phase === 'upload' && i === 0 ? 'bg-brand-700 text-white' :
  phase === 'preview' && i === 1 ? 'bg-brand-700 text-white' :
  phase === 'result' && i === 2 ? 'bg-green-600 text-white' :
  'bg-surface-muted text-text-tertiary'
}`}>{step}</span>
```

- [ ] **Step 7: Verify the dev server has no TypeScript/Vite errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: `built in Xs` with no errors. If errors appear, check the specific lines flagged.

- [ ] **Step 8: Screenshot to confirm visual correctness**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/login');
  await p.fill('input[type=\"email\"]', 'admin@test.local');
  await p.fill('input[type=\"password\"]', 'abc@123');
  await p.click('button[type=\"submit\"]');
  await p.waitForTimeout(3000);
  await p.goto('http://localhost:5173/assets');
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/tmp/task1-token-sweep.png', fullPage: true });
  await b.close();
})();
"
```
Open `/tmp/task1-token-sweep.png`. Confirm: primary buttons are brand blue (not Tailwind blue-600), text is not jarring gray, borders are consistent.

- [ ] **Step 9: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): replace all hardcoded Tailwind colors with design system tokens"
```

---

## Task 2 — Adopt `Button` Component for All Action Buttons

**Context:** Every button in the file uses inline Tailwind. The shared `Button` component at `frontend/src/components/ui/Button.tsx` handles variants (`primary`, `secondary`, `danger`, `ghost`), sizes (`sm`, `md`, `lg`), loading spinners, and Material Symbols icons. This task replaces inline buttons throughout.

**Button API reminder:**
```tsx
import { Button } from '../src/components/ui/Button';

<Button variant="primary" size="sm" icon="add" onClick={...}>Register Asset</Button>
<Button variant="secondary" size="sm" icon="download" loading={exporting} onClick={...}>Export CSV</Button>
<Button variant="danger" size="sm" onClick={...}>Delete Selected</Button>
<Button variant="ghost" size="sm" onClick={...}>Cancel</Button>
// type="submit" for form submit buttons
<Button type="submit" variant="primary" size="sm" loading={saving}>Register Asset</Button>
```

Icon names come from [Material Symbols](https://fonts.google.com/icons) — use the outlined variant name as a lowercase string.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add the Button import at the top of the file**

After the existing import block, add:
```tsx
import { Button } from '../src/components/ui/Button';
```

- [ ] **Step 2: Replace toolbar buttons in `AssetRegistryTab`**

Locate the toolbar div (around line 165). Replace:
```tsx
<button onClick={handleExportCsv} disabled={exporting} className="...">
  {exporting ? (<>..Exporting...</>) : (<>..Export CSV</>)}
</button>
{canImport && (
  <button onClick={() => setShowImportModal(true)} className="...">↑ Import CSV</button>
)}
{hasPermission(user?.permissions, 'asset:write') && (
  <button onClick={() => setShowCreateModal(true)} className="...">+ Register Asset</button>
)}
```
With:
```tsx
<Button variant="secondary" size="sm" icon="download" loading={exporting} onClick={handleExportCsv}>
  Export CSV
</Button>
{canImport && (
  <Button variant="secondary" size="sm" icon="upload" onClick={() => setShowImportModal(true)}>
    Import CSV
  </Button>
)}
{hasPermission(user?.permissions, 'asset:write') && (
  <Button variant="primary" size="sm" icon="add" onClick={() => setShowCreateModal(true)}>
    Register Asset
  </Button>
)}
```

- [ ] **Step 3: Replace bulk-delete action bar buttons**

In the bulk action bar (around line 190–203):
```tsx
<Button variant="danger" size="sm" loading={bulkDeleting} onClick={() => setShowBulkDeleteConfirm(true)}>
  Delete Selected
</Button>
<Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
  Clear Selection
</Button>
```

In the bulk delete confirmation (around line 211–214):
```tsx
<Button variant="ghost" size="sm" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
<Button variant="danger" size="sm" loading={bulkDeleting} onClick={handleBulkDelete}>
  Yes, Delete All
</Button>
```

- [ ] **Step 4: Replace "View" row-action button in the table**

Around line 297:
```tsx
<Button variant="ghost" size="sm" onClick={() => setSelectedAsset(asset)}>View</Button>
```

- [ ] **Step 5: Replace Export CSV button in `EmployeeAssetsTab`**

Around line 440:
```tsx
<Button variant="secondary" size="sm" icon="download" loading={exporting} onClick={handleExportCsv}>
  Export CSV
</Button>
```

- [ ] **Step 6: Replace the "Lookup any employee..." trigger**

Around line 536–538:
```tsx
<Button variant="ghost" size="sm" icon="search" onClick={() => setUserSearchMode(true)}>
  Lookup any employee...
</Button>
```

- [ ] **Step 7: Replace action buttons in `AssetDetailDrawer` header**

Around lines 748–790 — the Assign, Reassign, Return, Edit, Save, Cancel, Delete buttons:
```tsx
{!editing && canAssign && (
  <Button variant="primary" size="sm" onClick={() => openAssignModal(false)}>Assign</Button>
)}
{!editing && isAssigned && (
  <>
    <Button variant="secondary" size="sm" onClick={() => openAssignModal(true)}>Reassign</Button>
    <div className="relative">
      <Button variant="ghost" size="sm" className="border border-red-300 text-red-600 hover:bg-red-50" loading={returning} onClick={() => setShowReturnMenu(v => !v)}>
        Return
      </Button>
      {showReturnMenu && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-cwc-border rounded-cwc-lg shadow-cwc-lg py-1 z-10 min-w-[160px]">
          <button onClick={() => handleReturn('IN_STOCK')} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted text-text-primary">Return → In Stock</button>
          <button onClick={() => handleReturn('IN_REPAIR')} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted text-text-primary">Return → In Repair</button>
          <button onClick={() => handleReturn('PENDING_RETURN')} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted text-text-primary">Return → Pending Return</button>
        </div>
      )}
    </div>
  </>
)}
{editing ? (
  <>
    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
    <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>Save</Button>
  </>
) : (
  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
)}
{canDelete && !editing && (
  <Button variant="ghost" size="sm" className="border border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
    Delete
  </Button>
)}
```

- [ ] **Step 8: Replace buttons in delete confirmation panel and assign modal**

Delete confirmation panel (around line 801–804):
```tsx
<Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
<Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Yes, Delete</Button>
```

Assign modal footer (around line 993–1006):
```tsx
<Button variant="ghost" size="sm" onClick={() => { setShowAssignModal(false); setReassignMode(false); }}>
  Cancel
</Button>
<Button
  variant="primary"
  size="sm"
  disabled={!selectedUser}
  loading={assigning}
  onClick={handleAssign}
>
  {reassignMode ? 'Reassign' : 'Assign'}
</Button>
```

- [ ] **Step 9: Replace buttons in `AssetFormModal`**

Around line 1118–1122:
```tsx
<Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
<Button variant="primary" size="sm" type="submit" loading={saving}>Register Asset</Button>
```

- [ ] **Step 10: Replace buttons in `ImportAssetsModal`**

Upload phase footer (around line 1311–1319):
```tsx
<Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
<Button variant="primary" size="sm" disabled={!file} loading={parsing} onClick={handleParse}>
  Parse & Preview
</Button>
```

Preview phase commit button and back button (around line ~1400+):
```tsx
<Button variant="ghost" size="sm" onClick={() => setPhase('upload')}>Back</Button>
<Button variant="primary" size="sm" loading={committing} onClick={handleCommit}>
  Import {updateExisting ? parseResult.stats.newRows + parseResult.stats.duplicateRows : parseResult.stats.newRows} Rows
</Button>
```

Result phase close button:
```tsx
<Button variant="primary" size="sm" onClick={onClose}>Done</Button>
```

- [ ] **Step 11: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): adopt shared Button component throughout, remove all inline button styles"
```

---

## Task 3 — Adopt `Modal` Component for AssetFormModal and ImportAssetsModal

**Context:** Both modals roll their own overlay + panel with no focus trap, Escape-key close, or body scroll lock. The shared `Modal` from `frontend/src/components/ui/Modal.tsx` provides all three via portal rendering.

**Modal API:**
```tsx
import Modal from '../src/components/ui/Modal';

<Modal isOpen={show} onClose={onClose} title="Register New Asset" size="lg" footer={<>...</>}>
  {/* children go here — no need to render your own header or backdrop */}
</Modal>
```
`size` options: `sm` | `md` | `lg` | `xl` | `full`. The component renders a header with title + close button automatically when `title` is provided. Pass action buttons as `footer`.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add Modal import**

```tsx
import Modal from '../src/components/ui/Modal';
```

- [ ] **Step 2: Rewrite `AssetFormModal` to use Modal**

Replace the current `AssetFormModal` return statement. The form body content stays identical — only the outer wrapper changes:
```tsx
return (
  <Modal
    isOpen
    onClose={onClose}
    title="Register New Asset"
    size="lg"
    footer={
      <div className="flex justify-end gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" type="submit" form="asset-form" loading={saving}>
          Register Asset
        </Button>
      </div>
    }
  >
    <form id="asset-form" onSubmit={handleSubmit} className="space-y-4">
      {/* all existing form fields unchanged */}
    </form>
  </Modal>
);
```
Note: add `id="asset-form"` to the `<form>` tag and add `form="asset-form"` to the submit Button so it works when moved outside the form via `footer`.

- [ ] **Step 3: Rewrite `ImportAssetsModal` to use Modal**

The import modal has a custom header with a step indicator. Move the step indicator into the `title` prop area using a `React.ReactNode` trick — but since Modal's `title` prop is `string | undefined`, pass `title` as the asset name and render the stepper as a child. Instead, pass `title` as `undefined` and render a custom header as the first child:

```tsx
return (
  <Modal
    isOpen
    onClose={onClose}
    size="xl"
    footer={
      phase === 'upload' ? (
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!file} loading={parsing} onClick={handleParse}>
            Parse & Preview
          </Button>
        </div>
      ) : phase === 'preview' && parseResult ? (
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setPhase('upload')}>Back</Button>
          <Button variant="primary" size="sm" loading={committing} onClick={handleCommit}>
            Import {updateExisting
              ? parseResult.stats.newRows + parseResult.stats.duplicateRows
              : parseResult.stats.newRows} Rows
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
        </div>
      )
    }
  >
    {/* Custom header row with phase stepper */}
    <div className="flex items-center gap-3 mb-5">
      <h2 className="font-semibold text-text-primary text-base">
        {phase === 'upload' && 'Import Assets'}
        {phase === 'preview' && 'Preview & Validate'}
        {phase === 'result' && 'Import Results'}
      </h2>
      <div className="flex items-center gap-1 text-xs">
        {['Upload', 'Preview', 'Done'].map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <span className="text-text-tertiary">→</span>}
            <span className={`px-2 py-0.5 rounded-cwc-md text-xs font-medium ${
              phase === 'upload' && i === 0 ? 'bg-brand-700 text-white' :
              phase === 'preview' && i === 1 ? 'bg-brand-700 text-white' :
              phase === 'result' && i === 2 ? 'bg-green-600 text-white' :
              'bg-surface-muted text-text-tertiary'
            }`}>{step}</span>
          </React.Fragment>
        ))}
      </div>
    </div>

    {/* Phase bodies — move all existing phase JSX here unchanged */}
    {phase === 'upload' && ( /* ... existing upload JSX ... */ )}
    {phase === 'preview' && parseResult && ( /* ... existing preview JSX ... */ )}
    {phase === 'result' && commitResult && ( /* ... existing result JSX ... */ )}
  </Modal>
);
```

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Smoke test — open Register Asset modal**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/login');
  await p.fill('input[type=\"email\"]', 'admin@test.local');
  await p.fill('input[type=\"password\"]', 'abc@123');
  await p.click('button[type=\"submit\"]');
  await p.waitForTimeout(3000);
  await p.goto('http://localhost:5173/assets');
  await p.waitForTimeout(2000);
  await p.click('button:has-text(\"Register Asset\")');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/task3-modal.png', fullPage: true });
  // Test Escape closes it
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/task3-modal-closed.png', fullPage: true });
  await b.close();
})();
"
```
Confirm `/tmp/task3-modal.png` shows the modal open with proper focus trap styling. Confirm `/tmp/task3-modal-closed.png` shows the modal gone (Escape close working).

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): replace custom modal overlays with shared Modal component"
```

---

## Task 4 — Adopt `Drawer` Component for AssetDetailDrawer

**Context:** `AssetDetailDrawer` is a fully custom right-side panel with no focus trap or Escape-close. The shared Drawer from `frontend/src/components/ui/Drawer.tsx` handles these.

**Drawer API:**
```tsx
import { Drawer } from '../src/components/ui/Drawer';

<Drawer isOpen={!!selectedAsset} onClose={onClose} title="Asset Name" width="xl" side="right">
  {/* body content */}
</Drawer>
```
`width` options: `sm` | `md` | `lg` | `xl`. The Drawer component renders a header with title + close button and an overlay automatically.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add Drawer import**

```tsx
import { Drawer } from '../src/components/ui/Drawer';
```

- [ ] **Step 2: Rewrite AssetDetailDrawer to use Drawer**

The component currently renders a `fixed inset-0` div as the backdrop. Replace the outer `return` JSX with the Drawer wrapper. Move all body content (the sticky header section, the delete confirm bar, the form fields, the assign modal section) inside Drawer children. Move the action buttons from the sticky header into the Drawer `title` via a custom title approach — since Drawer's `title` is a string, render the header actions as a custom header inside children instead:

```tsx
if (loading) return (
  <Drawer isOpen onClose={onClose} width="xl" side="right" title="">
    <div className="flex items-center justify-center h-40">
      <p className="text-text-tertiary">Loading...</p>
    </div>
  </Drawer>
);

if (!asset) return null;

return (
  <Drawer isOpen onClose={onClose} width="xl" side="right" title={asset.name}>
    {/* Action buttons row — rendered as first child since Drawer title is string-only */}
    <div className="flex gap-2 items-center flex-wrap mb-4 pb-4 border-b border-cwc-border">
      <p className="text-sm text-text-tertiary font-mono mr-auto">{asset.assetTag}</p>
      {/* Assign / Reassign / Return / Edit / Save / Delete buttons — same as before, now using Button component from Task 2 */}
      {!editing && canAssign && (
        <Button variant="primary" size="sm" onClick={() => openAssignModal(false)}>Assign</Button>
      )}
      {/* ... rest of buttons from Task 2 step 7 ... */}
    </div>

    {/* Delete confirmation */}
    {showDeleteConfirm && (
      <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-cwc-lg">
        {/* ... unchanged content ... */}
      </div>
    )}

    {/* Detail fields */}
    <div className="space-y-4">
      {/* ... all existing field grid, device metadata, assignment history unchanged ... */}
    </div>

    {/* Assign panel */}
    {showAssignModal && (
      <div className="mt-4 pt-4 border-t border-cwc-border bg-surface-muted rounded-cwc-lg p-4">
        {/* ... existing assign panel content unchanged ... */}
      </div>
    )}
  </Drawer>
);
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Smoke test**

Manually verify drawer opens on "View" click and closes on Escape. Screenshot:
```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/login');
  await p.fill('input[type=\"email\"]', 'admin@test.local');
  await p.fill('input[type=\"password\"]', 'abc@123');
  await p.click('button[type=\"submit\"]');
  await p.waitForTimeout(3000);
  await p.goto('http://localhost:5173/assets');
  await p.waitForTimeout(2000);
  await p.screenshot({ path: '/tmp/task4-drawer.png', fullPage: true });
  await b.close();
})();
"
```
(Note: with empty DB, the drawer can only be tested once an asset is seeded. Confirm no crash on page load.)

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): replace custom drawer implementation with shared Drawer component"
```

---

## Task 5 — Adopt `Skeleton` and `EmptyState` Components

**Context:** Loading states display bare "Loading..." text. Empty states are inconsistent between tabs — the registry uses plain text, Employee Assets uses an emoji. Both should use the shared `Skeleton` and `EmptyState` components.

**Skeleton API:**
```tsx
import { Skeleton } from '../src/components/ui/Skeleton';
<Skeleton className="h-10 w-full" rounded="md" />
```

**EmptyState API:**
```tsx
import { EmptyState } from '../src/components/ui/EmptyState';
<EmptyState
  icon="inventory_2"
  title="No assets found"
  description="Register your first asset to get started"
  action={{ label: 'Register Asset', onClick: () => setShowCreateModal(true) }}
/>
```
`icon` must be a Material Symbols Outlined name string (e.g. `"inventory_2"`, `"person_off"`).

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { Skeleton } from '../src/components/ui/Skeleton';
import { EmptyState } from '../src/components/ui/EmptyState';
```

- [ ] **Step 2: Replace loading state in `AssetRegistryTab`**

Around line 222 — replace:
```tsx
{loading ? (
  <div className="text-center py-12 text-gray-400">Loading...</div>
) : assets.length === 0 ? (
  <div className="text-center py-12 text-gray-400">No assets found</div>
) : (
```
With:
```tsx
{loading ? (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" rounded="md" />
    ))}
  </div>
) : assets.length === 0 ? (
  <EmptyState
    icon="inventory_2"
    title="No assets found"
    description={search || filterStatus || filterCategory
      ? 'Try adjusting your search or filter criteria'
      : 'Register your first asset to get started'}
    action={hasPermission(user?.permissions, 'asset:write')
      ? { label: 'Register Asset', onClick: () => setShowCreateModal(true) }
      : undefined}
  />
) : (
```

- [ ] **Step 3: Replace loading state in `EmployeeAssetsTab`**

Around line 454 — replace:
```tsx
{loading ? (
  <div className="text-center py-12 text-gray-400">Loading assignments...</div>
) : userAssignments.length === 0 ? (
  <div className="text-center py-16">
    <div className="text-gray-300 text-5xl mb-4">📦</div>
    <p className="text-gray-500 font-medium">No employees with active assignments</p>
    <p className="text-gray-400 text-sm mt-1">Assets assigned to employees will appear here</p>
  </div>
) : (
```
With:
```tsx
{loading ? (
  <div className="space-y-2">
    {[...Array(4)].map((_, i) => (
      <Skeleton key={i} className="h-16 w-full" rounded="lg" />
    ))}
  </div>
) : userAssignments.length === 0 ? (
  <EmptyState
    icon="person_off"
    title="No employees with active assignments"
    description="Assets assigned to employees will appear here"
  />
) : (
```

- [ ] **Step 4: Replace inline loading in expanded user detail row**

Around line 491 — replace:
```tsx
{detailLoading ? (
  <div className="px-5 py-4 text-sm text-gray-400">Loading...</div>
```
With:
```tsx
{detailLoading ? (
  <div className="px-5 py-4 space-y-2">
    <Skeleton className="h-8 w-full" rounded="md" />
    <Skeleton className="h-8 w-3/4" rounded="md" />
  </div>
```

- [ ] **Step 5: Replace drawer loading state**

In `AssetDetailDrawer`, around line 718 — replace:
```tsx
if (loading) return (
  <Drawer isOpen onClose={onClose} width="xl" side="right" title="">
    <div className="flex items-center justify-center h-40">
      <p className="text-text-tertiary">Loading...</p>
    </div>
  </Drawer>
);
```
With:
```tsx
if (loading) return (
  <Drawer isOpen onClose={onClose} width="xl" side="right" title="">
    <div className="space-y-4 p-2">
      <Skeleton className="h-8 w-2/3" rounded="md" />
      <Skeleton className="h-6 w-full" rounded="md" />
      <Skeleton className="h-6 w-full" rounded="md" />
      <Skeleton className="h-6 w-1/2" rounded="md" />
    </div>
  </Drawer>
);
```

- [ ] **Step 6: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): replace loading text and emoji empty states with Skeleton and EmptyState components"
```

---

## Task 6 — Fix Return Dropdown Outside-Click Dismiss + Accessibility

**Context:** The "Return →" dropdown in the drawer has no close-on-outside-click handler. Also, all `×` close buttons on modals/drawers are inaccessible (no `aria-label`; the shared Modal and Drawer already handle their own close buttons, so this only applies to any remaining raw `×` buttons).

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add a `useClickOutside` hook inline**

At the top of the `AssetDetailDrawer` function body, add a ref and a `useEffect` to close the return menu when clicking outside:

```tsx
const returnMenuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!showReturnMenu) return;
  const handler = (e: MouseEvent) => {
    if (returnMenuRef.current && !returnMenuRef.current.contains(e.target as Node)) {
      setShowReturnMenu(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [showReturnMenu]);
```

- [ ] **Step 2: Attach the ref to the dropdown container**

On the `<div className="relative">` that wraps the Return button and its dropdown, add `ref={returnMenuRef}`:
```tsx
<div className="relative" ref={returnMenuRef}>
  <Button ... onClick={() => setShowReturnMenu(v => !v)}>Return</Button>
  {showReturnMenu && (
    <div className="absolute right-0 top-full mt-1 ...">
      {/* dropdown items */}
    </div>
  )}
</div>
```

- [ ] **Step 3: Audit remaining raw `×` close buttons**

After adopting Modal and Drawer (Tasks 3 & 4), confirm there are no remaining inline `×` close buttons in the file. Search:
```bash
grep -n '"×"' frontend/pages/AssetManagement.tsx
```
Expected: zero results (the shared Modal and Drawer components render their own accessible close button). If any remain, replace each with:
```tsx
<button
  type="button"
  aria-label="Close"
  onClick={onClose}
  className="text-text-tertiary hover:text-text-primary transition-colors"
>
  <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
</button>
```

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): add outside-click dismiss for return dropdown, fix accessible close buttons"
```

---

## Task 7 — Humanize Category Display Values

**Context:** Category values (`LAPTOP`, `SOFTWARE_LICENSE`, etc.) are displayed raw as uppercase enum strings in the table, drawer, and detail sections. Status values already have `s.replace(/_/g, ' ')` applied in dropdowns; category display needs the same treatment.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add a helper function near the top of the file**

After the `STATUSES` constant (around line 15), add:
```tsx
function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```
This produces: `SOFTWARE_LICENSE` → `Software License`, `IN_STOCK` → `In Stock`.

- [ ] **Step 2: Apply `humanize()` to category display in the table**

Around line 271:
```tsx
<td className="px-4 py-3 text-text-secondary">{humanize(asset.category)}</td>
```

- [ ] **Step 3: Apply `humanize()` to category display in the drawer body**

Around line 835:
```tsx
<p className="text-text-primary">{humanize(asset.category)}</p>
```

- [ ] **Step 4: Apply `humanize()` to status display in the expanded employee assets table**

Around line 511:
```tsx
<td className="px-5 py-2.5 text-text-secondary">{humanize(a.asset?.category ?? '')}</td>
```

- [ ] **Step 5: Update select options to use `humanize()` too for consistency**

Currently `CATEGORIES` select options are raw strings. Update both the filter select and the form select:
```tsx
{CATEGORIES.map(c => <option key={c} value={c}>{humanize(c)}</option>)}
```
Apply this in: filter select (line ~159), `AssetFormModal` category select (line ~1065), drawer edit select (line ~831).

- [ ] **Step 6: Build check and screenshot**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): humanize category and status display values throughout"
```

---

## Task 8 — Debounce Asset Registry Search

**Context:** The registry search fires an API call on every keystroke because `fetchAssets` has `search` as a `useCallback` dependency and `useEffect` re-runs whenever it changes. The fix: debounce `search` state into a `debouncedSearch` value that the fetch callback depends on instead.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add debounced search state to `AssetRegistryTab`**

In the `AssetRegistryTab` function body, after `const [search, setSearch] = useState('')`, add:
```tsx
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const id = setTimeout(() => setDebouncedSearch(search), 300);
  return () => clearTimeout(id);
}, [search]);
```

- [ ] **Step 2: Update `fetchAssets` to depend on `debouncedSearch` instead of `search`**

Change the `useCallback` (around line 89):
```tsx
const fetchAssets = useCallback(async () => {
  setLoading(true);
  try {
    const result = await assetService.listAssets({
      search: debouncedSearch || undefined,   // ← was: search
      status: (filterStatus as AssetStatus) || undefined,
      category: (filterCategory as AssetCategory) || undefined,
      limit: 50,
    });
    setAssets(result.assets);
    setTotal(result.total);
  } catch {
    toast.error('Error', 'Failed to load assets');
  } finally {
    setLoading(false);
  }
}, [debouncedSearch, filterStatus, filterCategory]);   // ← was: search
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): debounce registry search to prevent API call on every keystroke"
```

---

## Task 9 — Parallelize Bulk Delete

**Context:** Bulk delete iterates assets sequentially in a `for` loop (lines 129–133), firing one API call at a time. For 20 assets this could mean 20 sequential round-trips. Replace with `Promise.allSettled` for parallel execution.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Replace the sequential loop with `Promise.allSettled`**

Around lines 126–145, replace `handleBulkDelete`:
```tsx
const handleBulkDelete = async () => {
  setBulkDeleting(true);
  const ids = Array.from(selectedIds);
  const results = await Promise.allSettled(ids.map(id => assetService.deleteAsset(id)));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed === 0) {
    toast.success('Deleted', `${ids.length} asset${ids.length !== 1 ? 's' : ''} deleted`);
  } else {
    toast.error('Partial Failure', `${ids.length - failed} deleted, ${failed} failed`);
  }
  setSelectedIds(new Set());
  setShowBulkDeleteConfirm(false);
  setBulkDeleting(false);
  fetchAssets();
};
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): parallelize bulk delete with Promise.allSettled"
```

---

## Task 10 — Add Pagination to Asset Registry

**Context:** `listAssets()` is called with `limit: 50` and there is no UI for pages beyond the first 50. The API already returns `total`. Add a simple "Load more" offset-based approach — this is the least-invasive change that unblocks access to assets beyond 50 without requiring a full pagination redesign.

**Files:**
- Modify: `frontend/pages/AssetManagement.tsx`

- [ ] **Step 1: Add offset state to `AssetRegistryTab`**

```tsx
const [offset, setOffset] = useState(0);
const PAGE_SIZE = 50;
```

Reset offset to 0 whenever filters change by adding `setOffset(0)` inside a `useEffect` that watches `debouncedSearch`, `filterStatus`, `filterCategory`:
```tsx
useEffect(() => {
  setOffset(0);
}, [debouncedSearch, filterStatus, filterCategory]);
```

- [ ] **Step 2: Update `fetchAssets` to use offset and accumulate results**

```tsx
const fetchAssets = useCallback(async (reset = false) => {
  setLoading(true);
  const currentOffset = reset ? 0 : offset;
  try {
    const result = await assetService.listAssets({
      search: debouncedSearch || undefined,
      status: (filterStatus as AssetStatus) || undefined,
      category: (filterCategory as AssetCategory) || undefined,
      limit: PAGE_SIZE,
      offset: currentOffset,
    });
    setAssets(prev => currentOffset === 0 ? result.assets : [...prev, ...result.assets]);
    setTotal(result.total);
  } catch {
    toast.error('Error', 'Failed to load assets');
  } finally {
    setLoading(false);
  }
}, [debouncedSearch, filterStatus, filterCategory, offset]);
```

Update the `useEffect` trigger:
```tsx
useEffect(() => { fetchAssets(); }, [fetchAssets]);
```

- [ ] **Step 3: Add "Load more" button below the table**

After the closing `</div>` of the table container, add:
```tsx
{assets.length < total && (
  <div className="mt-4 flex justify-center">
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={() => setOffset(prev => prev + PAGE_SIZE)}
    >
      Load more ({total - assets.length} remaining)
    </Button>
  </div>
)}
```

- [ ] **Step 4: Ensure filter/search changes reset to page 1**

In the `useEffect` that resets offset (Step 1), also call `setAssets([])` to clear the accumulated list:
```tsx
useEffect(() => {
  setOffset(0);
  setAssets([]);
}, [debouncedSearch, filterStatus, filterCategory]);
```

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/AssetManagement.tsx
git commit -m "fix(itam): add load-more pagination to asset registry (was hard-capped at 50)"
```

---

## Self-Review

**Spec coverage check against audit findings:**

| Finding | Task |
|---|---|
| All colors use raw Tailwind | Task 1 |
| `Modal` component not used | Task 3 |
| `Drawer` component not used | Task 4 |
| `Skeleton`/`EmptyState` not used | Task 5 |
| `Button` component not used | Task 2 |
| No pagination | Task 10 |
| Category values shown as raw enums | Task 7 |
| Return dropdown has no outside-click dismiss | Task 6 |
| Bulk delete is sequential | Task 9 |
| Search in Asset Registry not debounced | Task 8 |
| `×` close buttons lack aria-label | Task 6 |
| Import CSV uses text arrow `↑` | Task 2 (replaced with `upload` icon via Button) |
| Assign flow embedded in drawer | Acknowledged — not changed; scope risk is too high without design sign-off. Noted for future UX iteration. |
| Import stepper uses hardcoded colors | Task 1 Step 6 |
| Empty state inconsistency across tabs | Task 5 |

**Placeholder scan:** None found — all tasks contain complete code blocks.

**Type consistency:** `humanize()` helper defined in Task 7 Step 1 and used in Steps 2–5. `debouncedSearch` defined in Task 8 Step 1 and consumed in Task 8 Step 2. `PAGE_SIZE` and `offset` defined in Task 10 Step 1 and used in Steps 2–4. All consistent.

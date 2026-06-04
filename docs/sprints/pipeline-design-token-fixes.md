# CRM Pipeline — Design System Token Audit Fixes

## Source

Audit conducted against:
- `/crm/pipeline` (Pipeline list view, new code)
- `/crm/opportunities` (existing reference page)
- `frontend/src/styles/tokens.css` (design token definitions)

All 7 findings from the audit. Each is a self-contained patch.

---

## Fix 1: Remove the separated header band — match Opportunities' flowing layout

**Problem:** Pipeline wraps title/filters in a `border-b border-border bg-surface shrink-0` header div, creating a visually distinct band. Opportunities has no such band — content flows freely with `px-4 sm:px-8 py-4 sm:py-8` and `mb-6` gap.

**Fix:** Remove the `border-b border-border bg-surface shrink-0` header wrapper div. Re-structure to match Opportunities' layout pattern.

**File:** `frontend/pages/CrmPipeline.tsx`

```diff
- <div className="px-4 sm:px-8 py-4 border-b border-border bg-surface shrink-0">
-   <div className="max-w-[1440px] mx-auto flex items-center justify-between flex-wrap gap-4">
+ <div className="px-4 sm:px-8 py-4 sm:py-8">
+   <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      {/* breadcrumb + title */}
    </div>
-   <div className="max-w-[1440px] mx-auto mt-3 flex items-center gap-3">
+   <div className="flex items-center gap-3 mb-5 flex-wrap">
      {/* search + filters */}
    </div>
- </div>
+ </div>
```

Key changes:
- Drop `border-b border-border bg-surface shrink-0` from header wrapper
- Drop `max-w-[1440px] mx-auto` (see Fix 6 for the replacement)
- Change `py-4` → `py-4 sm:py-8` to match Opportunities
- Add `mb-6` to the title row (same as Opportunities line 256)
- Add `mb-5` to the filter row (same as Opportunities line 279)
- Change `mt-3` → nothing (margin handled by parent gap)

---

## Fix 2: Match "New Opportunity" button padding to Opportunities page

**Problem:** Pipeline button `px-4 py-2` is smaller than Opportunities button `px-5 py-2.5`.

**Fix:** Align padding.

**File:** `frontend/pages/CrmPipeline.tsx`

```diff
- className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
+ className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
```

---

## Fix 3: Match search icon size to Opportunities page

**Problem:** Pipeline search icon uses `text-base` (15px), Opportunities uses `text-lg` (17px).

**Fix:** Change to `text-lg`.

**File:** `frontend/pages/CrmPipeline.tsx`

```diff
- <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-base">search</span>
+ <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
```

Also fixes a secondary inconsistency: Pipeline used `text-text-tertiary` for the search icon, while Opportunities uses `text-text-secondary`. Changed to match.

---

## Fix 4: Match search input padding to Opportunities page

**Problem:** Pipeline search input has tighter padding (`pl-9 pr-3 py-1.5`) vs Opportunities (`pl-10 pr-4 py-2`).

**Fix:** Align padding and add `min-w-[200px]`.

**File:** `frontend/pages/CrmPipeline.tsx`

```diff
- className="w-full pl-9 pr-3 py-1.5 border border-border rounded-lg text-sm bg-surface-muted outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all"
+ className="w-full pl-10 pr-4 py-2 bg-surface-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
```

Also adjusts the filter container to match:
```diff
- <div className="relative flex-1 max-w-xs">
+ <div className="relative flex-1 min-w-[200px] max-w-md">
```

This matches the Opportunities pattern exactly (`min-w-[200px] max-w-md`).

---

## Fix 5: Remove `font-semibold` from pipeline dropdown select

**Problem:** Pipeline `<select>` has `font-semibold` class; Opportunities does not.

**Fix:** Remove `font-semibold` to match. Both use `text-text-primary`.

**File:** `frontend/pages/CrmPipeline.tsx`

```diff
- className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-text-primary outline-none cursor-pointer"
+ className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary outline-none cursor-pointer"
```

---

## Fix 6: Harmonize max-width constraint

**Problem:** Pipeline uses `max-w-[1440px]` (Tailwind arbitrary value), Opportunities uses `maxWidth: 1400` (inline style). Both cap content width but at slightly different values.

**Fix:** Use the same approach on both pages. Since the Pipeline page currently has a `max-w-[1440px] mx-auto` wrapper (which we are removing in Fix 1), we add a `style={{ maxWidth: 1400, margin: '0 auto' }}` to the outer container — exactly matching Opportunities line 255.

**File:** `frontend/pages/CrmPipeline.tsx`

After Fix 1 removes the two `max-w-[1440px] mx-auto` wrappers, add a style to the parent `<div>`:

```diff
- <div className="px-4 sm:px-8 py-4 sm:py-8">
+ <div className="px-4 sm:px-8 py-4 sm:py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>
```

This ensures both pages use the identical 1400px max-width and centering.

---

## Fix 7: Remove inline `style={{ border: 'none', cursor: 'pointer' }}` from toggle buttons

**Problem:** Toggle buttons use inline `style={{ border: 'none', cursor: 'pointer' }}` instead of utility classes. While this matches a pattern used elsewhere (Opportunities also does this for buttons), it's not token-based and bypasses Tailwind.

**Fix:** Replace inline styles with Tailwind utility classes.

**File:** `frontend/pages/CrmPipeline.tsx`

For both toggle buttons:
```diff
  <button
    onClick={() => setViewMode('list')}
    className={`p-2 text-sm ${viewMode === 'list' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
-   style={{ border: 'none', cursor: 'pointer' }}
+   className={`p-2 text-sm border-none cursor-pointer ${viewMode === 'list' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
    title="Table view"
  >
```

**Wait — there's an issue:** Tailwind v4 doesn't have a `border-none` utility in the default theme. The `border: none` reset is needed because `<button>` elements have a default border. The cleanest approach is to add a reset class or use `ring-0 ring-offset-0` instead. However, the simplest and most consistent fix is:

```diff
-   style={{ border: 'none', cursor: 'pointer' }}
+   className="... border-0 cursor-pointer"
```

`border-0` sets `border-width: 0` which effectively removes the border. `cursor-pointer` is already a Tailwind utility.

Revised toggle button markup:
```tsx
<button
  onClick={() => setViewMode('list')}
  className={`p-2 text-sm border-0 cursor-pointer ${viewMode === 'list' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
  title="Table view"
>
  <span className="material-symbols-outlined text-base">view_list</span>
</button>
<button
  onClick={() => setViewMode('kanban')}
  className={`p-2 text-sm border-0 cursor-pointer ${viewMode === 'kanban' ? 'bg-brand-700 text-white' : 'bg-surface text-text-secondary hover:bg-bg-subtle'}`}
  title="Kanban view"
>
  <span className="material-symbols-outlined text-base">view_kanban</span>
</button>
```

---

## Implementation Order

Recommended tackle order (each is independent but Fix 1 and Fix 6 touch the same wrapper div):

1. **Fix 2** — Button padding (single class change, no layout impact)
2. **Fix 3** — Search icon size (single class change)
3. **Fix 4** — Search input padding (class change + container class change)
4. **Fix 5** — Remove font-semibold from select (single class removal)
5. **Fix 7** — Replace inline styles with Tailwind utilities (two buttons)
6. **Fix 1 + Fix 6** — Layout restructure (these touch the same wrapper div, do together)

Fix 1 + Fix 6 combined diff for the wrapper:

```diff
- <div className="px-4 sm:px-8 py-4 border-b border-border bg-surface shrink-0">
-   <div className="max-w-[1440px] mx-auto flex items-center justify-between flex-wrap gap-4">
+ <div className="px-4 sm:px-8 py-4 sm:py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>
+   <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
      {/* breadcrumb + title + buttons */}
    </div>
-   <div className="max-w-[1440px] mx-auto mt-3 flex items-center gap-3">
+   <div className="flex items-center gap-3 mb-5 flex-wrap">
      {/* search + filters */}
    </div>
  </div>
```

## Verification

After applying all fixes:
1. `npx tsc --noEmit` — zero new errors
2. Browser test `/crm/pipeline` — visually compare against `/crm/opportunities`
3. Confirm search input height matches, button height matches, no border-b on header
4. Confirm dark mode tokens still resolve correctly (all classes use token names, no hardcoded hex)
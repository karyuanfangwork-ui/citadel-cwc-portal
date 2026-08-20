# Task 4 — notification icon layout-shift fix

## Root cause

Before Material Symbols loads, the bell glyph's fallback text (`notifications`) has an intrinsic width of about 118.7px. The text escaped its fixed 40px button and widened the mobile top bar/body to 413px at a 390px viewport.

## Change

- The fixed notification button now clips overflow and remains shrink-safe.
- The Material Symbols span has no minimum-content width and clips its fallback label until the icon font is available.
- Notification interactions and desktop styling are unchanged.

## Verification

- Regression test was red before the production change and green after it: `npm test -- src/components/__tests__/NotificationDropdown.test.tsx` (1/1 passed).
- Production build passed: `npm run build`.
- `git diff --check` passed.
- The existing mobile Playwright suite was attempted unchanged, but Chromium cannot launch within the sandbox. The escalated retry was stopped at the user's request before a result was available.

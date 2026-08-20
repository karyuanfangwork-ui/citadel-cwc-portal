# Final fix report — notification unread badge

## Root cause

The notification button used `overflow-hidden` to contain the Material Symbols
font-loading fallback. The unread badge is absolutely positioned outside the
button bounds with `-top-1 -right-1`, so the same containment clipped it.

## Change

- Restored visible overflow on the 40px notification button so the unread badge
  can render outside its edge.
- Added a fixed 24px, overflow-hidden icon wrapper around the Material Symbols
  glyph so a raw `notifications` fallback cannot widen the page.
- Updated the focused regression test to render `unreadCount: 12` and assert
  both badge visibility and the dedicated icon containment structure.

## Verification

- `cd frontend && npm test -- --run src/components/__tests__/NotificationDropdown.test.tsx`
  - Passed: 1 test file, 1 test.
- `cd frontend && npm run build`
  - Passed: Vite production build completed successfully.
- `git diff --check`
  - Passed: no whitespace errors.

## Scope

Only `NotificationDropdown.tsx`, its focused test, and this report are part of
this fix.

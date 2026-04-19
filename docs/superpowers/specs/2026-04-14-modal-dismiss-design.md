# Modal Dismiss — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Problem

All 10 workflow modals in `frontend/src/components/request-detail/` lack Escape key and backdrop-click dismiss. Users must click Cancel to close, which is friction and breaks expected web UX conventions.

## Solution

A single `useModalDismiss` hook centralises the dismiss behaviour. Each modal calls the hook and wires up two lines — no structural refactoring of modal markup required.

## Hook: `useModalDismiss`

**Location:** `frontend/src/hooks/useModalDismiss.ts`

```ts
function useModalDismiss(onClose: () => void): {
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}
```

**Behaviour:**
- Attaches a `keydown` listener on `document` for `Escape` → calls `onClose`
- Cleans up the listener on unmount
- Returns `handleBackdropClick(e)` which calls `onClose` only when `e.target === e.currentTarget` (click landed on the backdrop overlay, not the modal card itself)

## Modals Updated

All 10 modals in `frontend/src/components/request-detail/`:

1. `WorkflowApproveModal.tsx`
2. `WorkflowRejectModal.tsx`
3. `AssignAgentModal.tsx`
4. `FulfilmentModal.tsx`
5. `HardwareOrderedModal.tsx`
6. `HardwareReceivedModal.tsx`
7. `ProcurementModal.tsx`
8. `ResubmitModal.tsx`
9. `SoftwareProvisionedModal.tsx`
10. `SubmitForApprovalModal.tsx`
11. `VpApprovalModal.tsx`

Each modal change:
1. Import and call `useModalDismiss(onClose)`
2. Add `onClick={handleBackdropClick}` to the outer backdrop `div` (`fixed inset-0 bg-black/40 ...`)

## Out of Scope

- Unsaved-change guard before dismiss (no modals currently track dirty state)
- Animation on close
- `ActionBanner` component (not a modal overlay)

# Flutter Credit Mobile App — Design Spec
**Date:** 2026-06-05  
**Scope:** Core credit operations (Scope B)  
**Target users:** Hybrid — internal credit staff (RMs, analysts, approvers, committee members) + external borrowers  
**Architecture decision:** Flutter Flavors — one monorepo, two published apps (`cwc_staff`, `cwc_borrower`)  
**Auth:** JWT + device trust layer + biometric unlock  
**Borrower access:** Self-registration with application reference number linking

---

## 1. Architecture

### Repository Structure

```
cwc_mobile/
├── lib/
│   ├── core/                    # Shared across both flavors
│   │   ├── api/                 # Dio HTTP client, JWT interceptor, token refresh
│   │   ├── auth/                # JWT + device trust + biometric (local_auth)
│   │   ├── models/              # Dart models mirroring credit.service.ts types
│   │   └── storage/             # flutter_secure_storage wrapper
│   ├── staff/                   # Staff flavor feature trees
│   │   ├── dashboard/
│   │   ├── approvals/           # Port of MobileApprovalInbox.tsx
│   │   ├── committee/           # Port of CommitteeMobileVote.tsx
│   │   ├── applications/        # List, detail, create, edit
│   │   └── borrowers/           # Profile list, create, document checklist
│   └── borrower/                # Borrower flavor feature trees
│       ├── tracker/             # Application status timeline
│       ├── documents/           # Upload checklist
│       └── esign/               # E-sign offer flow
├── flavors/
│   ├── staff/                   # main_staff.dart, flavor config, branding assets
│   └── borrower/                # main_borrower.dart, flavor config, branding assets
└── test/
    ├── core/
    ├── staff/
    └── borrower/
```

### Key Design Principles

- The `core/` API client talks directly to the existing Express backend — no BFF (Backend for Frontend) layer required.
- All existing `/api/v1/credit/*` REST endpoints are consumed as-is. No backend route changes needed beyond the additions listed in Section 4.
- Flavor separation is enforced at build time: the staff binary never contains borrower feature code and vice versa. This satisfies data segregation requirements for a financial app under App Store review.
- State management: **Riverpod** (type-safe, testable, flavor-agnostic). Each feature tree owns its own providers.

---

## 2. Staff App — Feature Set (`cwc_staff`)

### 2.1 Approval Inbox
*Port of `frontend/pages/credit/MobileApprovalInbox.tsx`*

- Card list: borrower name, product type, amount, days waiting, urgency badge
- Filter chips: All / Urgent / Awaiting Me
- Tap card → slide-up bottom sheet with approval pack preview
- Action bar: **APPROVE** / **REJECT** (mandatory comment modal) / **DEFER** / **RETURN**
- Pull-to-refresh
- Push notification on new approval request routed to user
- API: `GET /credit/dashboard/approval-inbox`, `POST /credit/approvals/:id/decide`

### 2.2 Committee Voting
*Port of `frontend/pages/credit/CommitteeMobileVote.tsx`*

- Sticky top bar: meeting title, deal counter (e.g. "Deal 2 of 5")
- Agenda item carousel with swipe navigation
- Collapsible CA Memo/approval pack preview
- Vote buttons: **APPROVE** / **CONDITIONAL** / **REJECT** / **DEFER** — minimum 44px touch targets
- Mandatory comment on REJECT
- Progress dots at bottom
- Push notification when a committee meeting is scheduled and user is a member
- API: `committeeApi` (existing)

### 2.3 Dashboard
- Pipeline KPIs: application counts by state (DRAFT / SUBMITTED / UNDERWRITING / COMMITTEE_REVIEW / APPROVED)
- Pending approvals count with urgency breakdown
- SLA breach alerts (tappable → filtered application list)
- Recent activity feed (last 10 state changes across user's portfolio)
- API: `GET /credit/dashboard/*` (existing)

### 2.4 Application Management
- **List:** search by borrower name / reference number, filter by state, sort by SLA deadline
- **Detail (read):** key fields (product, amount, currency, state badge, assigned RM/analyst), scoring summary, approval chain progress, facility list, collateral count
- **Create:** borrower picker → product type → amount + currency → request type → submit (sets state to DRAFT)
- **Edit:** loan request fields, facility type/amount, party assignment (RM / analyst), request type
- API: `GET /credit/applications`, `POST /credit/applications`, `PATCH /credit/applications/:id`

### 2.5 Borrower Profile
- **List:** search by company name / registration number
- **Create:** company name, business registration number, sector, primary contact name + email
- **Detail (read):** company info, directors list, shareholders list, UBOs, document checklist status (PENDING / VERIFIED / REJECTED per document type)
- Note: Director/shareholder/UBO editing stays desktop-only at this scope — PII entry on mobile is high error-risk
- API: `GET /credit/borrowers`, `POST /credit/borrowers`, `GET /credit/borrowers/:id`

---

## 3. Borrower App — Feature Set (`cwc_borrower`)

### 3.1 Registration & Application Linking
- Standard email + password registration (calls existing `POST /api/v1/auth/register` with `userType: "BORROWER"`)
- Email verification step
- After verification: enter **Application Reference Number** (provided by RM out-of-band)
- Backend links borrower account to application via new `POST /credit/applications/link` endpoint
- One borrower account can link to multiple applications (e.g. renewal next year)

### 3.2 Application Status Tracker
- Visual vertical timeline: each application state rendered as a node (completed / current / upcoming)
- States shown: SUBMITTED → KYC_REVIEW → KYC_APPROVED → UNDERWRITING → CREDIT_ASSESSMENT → COMMITTEE_REVIEW → APPROVED / REJECTED
- Each node: human-readable label, completion date (if passed), estimated SLA (from `creditSla`)
- Current state node: animated pulse indicator
- Push notification fires on every state transition
- REJECTED state: shows reason if one was recorded by analyst
- API: `GET /credit/applications/:id` (borrower-scoped by JWT claim)

### 3.3 Document Upload
- Checklist of required documents per application (driven by `CreditDocument` records)
- Each item shows: document type label, status badge (PENDING / VERIFIED / REJECTED), rejection reason if applicable
- Tap pending item → bottom sheet: camera capture or file picker (PDF, JPG, PNG, max 20MB)
- Upload progress indicator; ClamAV scan result surfaced inline ("Scanning…" → "Clean" / "Rejected — malware detected")
- Verified items are locked (cannot re-upload unless RM rejects them)
- API: `POST /credit/documents` (existing), `GET /credit/documents?applicationId=` (borrower-scoped)

### 3.4 E-Sign
- Triggered when application reaches OFFER state (push notification + in-app banner)
- Offer letter presented as a PDF viewer (flutter_pdfview)
- "Sign Now" routes to e-sign adapter — **currently a placeholder** (`esign.placeholder.ts`)
- Until e-sign provider is procured: "Download & Sign Manually" fallback shown, with upload slot for signed copy
- E-sign provider recommendation: DocuSign (enterprise) or SigningCloud (Malaysia-local compliance)
- API: e-sign adapter endpoint (TBD on provider selection)

### 3.5 Secure Messaging
- Threaded comment feed between borrower and assigned RM
- Borrower can read/write; internal analyst notes are hidden (RBAC-filtered on backend)
- Push notification on new message from RM
- Simple text only at this scope (no file attachments in messaging — documents go through 3.3)
- API: application activity/comments endpoint (existing `RequestActivity` pattern, needs credit equivalent confirmed)

---

## 4. Auth & Device Trust Layer

### 4.1 New Prisma Model

```prisma
model MobileDevice {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  deviceToken  String    @unique   // UUID generated on first app install
  platform     String              // "ios" | "android"
  fcmToken     String?             // Firebase Cloud Messaging token for push
  biometricKey String?             // Public key from device secure enclave (future)
  lastSeenAt   DateTime
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())
}
```

### 4.2 New Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/mobile/register-device` | Called on first launch after login. Stores device token + FCM token + platform. |
| `DELETE` | `/api/v1/auth/mobile/revoke-device/:deviceToken` | Admin or user: revoke a device session remotely. Invalidates all tokens for that device. |
| `POST` | `/api/v1/credit/applications/link` | Borrower links their account to an application via reference number. Creates `ApplicationBorrowerLink` record. |

### 4.3 Authentication Flow

**Staff first login:**
1. Email + password → `POST /auth/login` → JWT issued
2. Flutter stores JWT in `flutter_secure_storage`
3. `POST /auth/mobile/register-device` called with device UUID + FCM token
4. Backend attaches `deviceToken` claim to subsequent JWT refresh tokens

**Staff subsequent launches:**
1. `local_auth` prompts Face ID / fingerprint
2. On success: read JWT from secure storage → attach `X-Device-Token` header to all requests
3. Backend middleware validates device token is not revoked on every credit-scoped request

**PII access logging:**
- Existing `piiReadLog` middleware reads `X-Device-Token` from request headers
- Logs `deviceId` alongside every PII field reveal — zero structural refactor, header addition only

**Borrower registration:**
1. `POST /auth/register` with `userType: "BORROWER"`
2. Email verification
3. `POST /credit/applications/link` with reference number
4. Device registered same as staff flow (no biometric requirement for borrower app, but supported)

### 4.4 Borrower Data Isolation
- All borrower API calls filtered by `borrowerId` claim in JWT on the backend
- Borrower cannot retrieve any application they are not explicitly linked to
- Borrower cannot access scorecard, financial, committee, or approval data — RBAC enforced via `credit:read` permission which borrowers do not hold; borrower-specific endpoints use a new `credit:borrower` permission

---

## 5. Push Notifications

- **Gateway:** Firebase Cloud Messaging (FCM) — covers both iOS (via APNs bridge) and Android
- **Backend:** New `creditPushNotification.service.ts` wraps existing `creditNotification.service.ts`, adds FCM dispatch alongside existing SSE events
- **Triggers (staff):** New approval routed to user, approval decision made on their application, committee meeting scheduled, SLA breach imminent
- **Triggers (borrower):** Application state transition, document verified or rejected, new message from RM, offer ready to sign

---

## 6. Effort Estimate

**Team:** 2 Flutter developers + 1 backend developer (~40% allocation)

| Phase | Scope | Duration | Backend Dev-Days |
|-------|-------|----------|-----------------|
| P1 — Foundation | Flutter project + flavor config, core API client, JWT + device trust, biometric auth, shared UI kit, FCM setup | 3 weeks | 8 days |
| P2 — Staff App MVP | Approval Inbox + Committee Voting (ports), Dashboard, Application list + detail, push notifications | 4 weeks | 2 days |
| P3 — Borrower App MVP | Registration + linking, Status tracker, Document upload, push notifications on state transitions | 3 weeks | 3 days |
| P4 — Core Ops Expansion | Staff: Application create/edit, Borrower profile create; Borrower: E-sign, Secure messaging | 5 weeks | 4 days |

**Total: ~15 weeks | ~17 backend dev-days**

---

## 7. Risk Register

| Risk | Level | Mitigation |
|------|-------|-----------|
| E-sign adapter is a placeholder | 🔴 High | Procure e-sign provider (DocuSign or SigningCloud) in parallel with P1. P4 borrower e-sign is blocked until this is resolved. Fallback: manual download + re-upload. |
| Bureau / AML adapters are placeholders | 🟡 Medium | No mobile impact on data entry. Staff app surfaces bureau check status gracefully as "Pending Integration" badge. No blocking risk. |
| PII field decryption on mobile latency | 🟡 Medium | Existing `piiRevealApi` + `X-Device-Token` header handles this. Measure latency on real device + cellular. Add skeleton loaders for PII fields. |
| Offline connectivity (field visits) | 🟡 Medium | Not in scope but will be hit by RMs. Recommend read-only offline cache for application detail in P2 using `hive` or `drift`. Scope explicitly deferred. |
| App Store review delays | 🟠 Low-Medium | Financial apps with document upload + e-sign get heightened scrutiny. Buffer 2–3 weeks for review cycles at P2 and P4 launches. Prepare privacy manifest and data usage declarations early. |
| Secure messaging API gap | 🟡 Medium | `RequestActivity` pattern exists in ITSM module but credit equivalent needs verification. Backend dev-day allocation in P4 covers this. |

---

## 8. Impact Assessment

| Impact Area | Level | Reasoning |
|-------------|-------|-----------|
| Approval turnaround time | 🔴 Very High | Approvers currently need desktop access. Mobile inbox removes the biggest bottleneck — deals blocked waiting for a senior approver on travel or in meetings. |
| Committee meeting efficiency | 🟠 High | Members can vote from anywhere. Eliminates scheduling delays caused by physical quorum requirements. |
| Borrower document submission | 🟠 High | Replaces email/manual submission. Camera upload with instant verification status removes back-and-forth cycles. |
| RM field productivity | 🟡 Medium | Application creation on mobile useful for new deal capture in client meetings. Full data entry (financials, scorecard) stays desktop — not practical at this scope. |
| Compliance posture | 🟠 High | Device trust + biometric + PII audit logs on mobile improves the audit trail vs. web-only access. Borrower document upload via authenticated app is more auditable than email. |

---

## 9. Explicitly Out of Scope (Deferred to Phase 5)

- Scorecard entry and financial spreading on mobile (17-tab CA Memo wizard)
- Admin screens: scorecard versioning, approval matrix config, feature flag management
- Reporting and analytics dashboards
- Collateral and condition management
- Monitoring watchlist management
- Director / shareholder / UBO data entry on mobile (PII error risk)

---

## 10. Key Dependencies & Decisions Required

1. **E-sign provider selection** — must be resolved before P4 starts. Recommend starting RFP in P1.
2. **FCM project setup** — requires Google Firebase project creation and APNs certificate for iOS.
3. **`credit:borrower` RBAC permission** — new permission needs to be seeded and documented in RBAC matrix (`docs/credit-assessment/17-rbac-verification-matrix.md`).
4. **Application reference number format** — needs to be defined (e.g. `CA-2026-00123`). Currently the `id` field is a `cuid()` — a human-readable reference number field should be added to `CreditApplication`.
5. **Borrower invitation UX** — how does the RM communicate the reference number? Email template, SMS, or in-app share link? Recommend email template via existing `email.service.ts`.

# Fix P1 Foundation Plan — Critical & High Issues

Fixes for the 4 critical and 4 tightly-coupled high issues identified in the [audit](file:///Users/fangkaryuan/.gemini/antigravity-ide/brain/d44e518f-2674-49aa-a2f8-01e1f7f1a0b7/implementation_plan_audit.md) of the [P1 Foundation Plan](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md).

**Scope:** Patch the P1 plan document in-place so that an implementing agent produces correct, codebase-consistent output on the first pass.

---

## Open Questions

> [!IMPORTANT]
> **Borrower Registration Flow (Audit issue #9)**
> The existing backend has registration **disabled** ([auth.routes.ts:11](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/routes/auth.routes.ts#L11)). The Flutter plan includes a `register()` method in `AuthService`. Two options:
>
> **Option A:** Admin-provisioned accounts only — remove `register()` from Flutter `AuthService` and the `/register` route from the borrower router. Borrowers are created by staff and receive login credentials out-of-band.
>
> **Option B:** Add a new `/auth/mobile/register` endpoint gated by an invitation code or referenceNumber — borrowers self-register but only with a valid code. This requires a new backend task in P1.
>
> **Which approach do you prefer?**

---

## Proposed Changes

### Fix 1 — Schema: `referenceNumber` → use existing `applicationNo` 🔴

**Problem:** The plan adds a `referenceNumber` field to `CreditApplication` (Task 1, Step 2), but the model already has [`applicationNo`](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/schema.prisma#L3136) which serves the same purpose. Every downstream query referencing `referenceNumber` will fail.

**Impact:** Plan Tasks 1, 5, 6, 12

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 1, Step 2 (lines 102–107):** Delete entirely — no new field needed.

```diff
-- [ ] **Step 2: Add referenceNumber field to CreditApplication**
-
-In the `CreditApplication` model, add after the `id` field:
-```prisma
-  referenceNumber  String?  @unique @map("reference_number") @db.VarChar(30)
-```
```

**Task 5 (line 504):** Replace `referenceNumber` with `applicationNo`:

```diff
-    const label = app.borrowerProfile?.companyName ?? app.referenceNumber ?? applicationId;
+    const label = app.borrowerProfile?.companyName ?? app.applicationNo ?? applicationId;
```

**Task 5 (lines 499–501):** Fix the select to use `applicationNo`:

```diff
       select: {
-        referenceNumber: true,
+        applicationNo: true,
         borrowerProfile: { select: { companyName: true } }
       },
```

**Task 6, Step 1 (lines 596–600):** Rewrite `linkByReferenceNumber` to query `applicationNo`:

```diff
-  async linkByReferenceNumber(userId: string, referenceNumber: string) {
+  async linkByApplicationNo(userId: string, applicationNo: string) {
     const application = await prisma.creditApplication.findUnique({
-      where: { referenceNumber },
-      select: { id: true, referenceNumber: true },
+      where: { applicationNo },
+      select: { id: true, applicationNo: true },
     });
```

**Task 6, Step 2 (line 652):** Update the controller call:

```diff
-  const result = await applicationBorrowerLinkService.linkByReferenceNumber(
-    user.id, referenceNumber.trim().toUpperCase()
+  const result = await applicationBorrowerLinkService.linkByApplicationNo(
+    user.id, referenceNumber.trim().toUpperCase()
   );
```

> [!NOTE]
> The controller param name can stay `referenceNumber` in the request body (borrower-facing label) — only the service method and Prisma query use `applicationNo`.

**Task 6, Step 1 (lines 621–628):** Fix the `getLinkedApplications` select:

```diff
         application: {
           select: {
             id: true,
-            referenceNumber: true,
+            applicationNo: true,
             state: true,
             productType: true,
-            totalFacilityAmount: true,
+            requestedAmount: true,
             currency: true,
             borrowerProfile: { select: { companyName: true } },
           },
```

**Task 12 — Flutter models (lines 1479, 1505–1506):** Rename field:

```diff
-  final String? referenceNumber;
+  final String? applicationNo;
   // ...
-    referenceNumber: j['referenceNumber'] as String?,
+    applicationNo: j['applicationNo'] as String?,
```

---

### Fix 2 — Schema: `totalFacilityAmount` → use existing `requestedAmount` 🔴

**Problem:** `CreditApplication` has no field called `totalFacilityAmount`. The actual field is [`requestedAmount`](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/schema.prisma#L3149) (`Decimal(15,2)`).

**Impact:** Plan Tasks 6, 12

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 6 `getLinkedApplications` select:** Already covered in Fix 1 diff above.

**Task 12 — Flutter `CreditApplication` model (lines 1482, 1507):**

```diff
-  final double? totalFacilityAmount;
+  final double? requestedAmount;
   // ...
-    totalFacilityAmount: (j['totalFacilityAmount'] as num?)?.toDouble(),
+    requestedAmount: (j['requestedAmount'] as num?)?.toDouble(),
```

**Task 12 — Constructor (line 1476):**

```diff
     this.productType,
-    this.totalFacilityAmount,
+    this.requestedAmount,
     this.currency,
```

---

### Fix 3 — Schema: Align new models to project UUID convention 🔴

**Problem:** The plan uses `@default(cuid())` for `MobileDevice.id` and `ApplicationBorrowerLink.id`. Every other model in the schema uses `@default(uuid()) @db.Uuid`, and `userId` references a UUID column.

**Impact:** Plan Task 1

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 1, Step 1 — `MobileDevice` model (lines 63–75):** Replace with UUID-consistent version:

```diff
 model MobileDevice {
-  id           String    @id @default(cuid())
-  userId       String    @map("user_id")
+  id           String    @id @default(uuid()) @db.Uuid
+  userId       String    @map("user_id") @db.Uuid
   user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
   deviceToken  String    @unique @map("device_token")
   platform     String    @db.VarChar(10)
   fcmToken     String?   @map("fcm_token")
-  lastSeenAt   DateTime  @default(now()) @map("last_seen_at")
-  revokedAt    DateTime? @map("revoked_at")
-  createdAt    DateTime  @default(now()) @map("created_at")
+  lastSeenAt   DateTime  @default(now()) @map("last_seen_at") @db.Timestamp(6)
+  revokedAt    DateTime? @map("revoked_at") @db.Timestamp(6)
+  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamp(6)

   @@map("mobile_devices")
 }
```

**Task 1, Step 1 — `ApplicationBorrowerLink` model (lines 77–88):**

```diff
 model ApplicationBorrowerLink {
-  id            String   @id @default(cuid())
-  userId        String   @map("user_id")
-  applicationId String   @map("application_id")
-  createdAt     DateTime @default(now()) @map("created_at")
+  id            String   @id @default(uuid()) @db.Uuid
+  userId        String   @map("user_id") @db.Uuid
+  applicationId String   @map("application_id") @db.Uuid
+  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(6)

   user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
   application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

   @@unique([userId, applicationId])
+  @@index([userId])
+  @@index([applicationId])
   @@map("application_borrower_links")
 }
```

> [!NOTE]
> Added `@@index` on the FK columns — consistent with every other FK in the schema (e.g., `@@index([borrowerProfileId])` on `CreditApplication`).

---

### Fix 4 — Controllers: Use `AuthRequest` + `asyncHandler` 🔴

**Problem:** The plan's controllers use `(req as any).user` and raw `async` handlers. The codebase has:
- [`AuthRequest`](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/middleware/auth.middleware.ts#L11-L23) — typed request interface
- [`asyncHandler`](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/middleware/error.middleware.ts#L68-L72) — wraps handlers so unhandled promise rejections go to the error middleware

Without `asyncHandler`, a Prisma error (e.g., record not found) will crash the process.

**Impact:** Plan Tasks 3, 6

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 3, Step 1 — `mobileDevice.controller.ts` (lines 269–318):** Full replacement:

```typescript
// backend/src/controllers/mobileDevice.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { mobileDeviceService } from '../services/mobileDevice.service';

export const registerDevice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { deviceToken, platform, fcmToken } = req.body;

  if (!deviceToken || !platform || !['ios', 'android'].includes(platform)) {
    res.status(400).json({ status: 'error', message: 'deviceToken and platform (ios|android) required' });
    return;
  }

  const device = await mobileDeviceService.register({
    userId,
    deviceToken,
    platform,
    fcmToken,
  });

  res.status(201).json({ status: 'success', data: { device } });
});

export const revokeDevice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { deviceToken } = req.params;

  // Verify this device belongs to the requesting user
  const devices = await mobileDeviceService.getByUserId(userId);
  const owns = devices.some(d => d.deviceToken === deviceToken);

  if (!owns) {
    const isAdmin = req.user!.roles?.includes('ADMIN');
    if (!isAdmin) {
      res.status(403).json({ status: 'error', message: 'Forbidden' });
      return;
    }
  }

  await mobileDeviceService.revoke(deviceToken);
  res.json({ status: 'success', data: { revoked: true } });
});

export const listDevices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const devices = await mobileDeviceService.getByUserId(req.user!.id);
  res.json({ status: 'success', data: { devices } });
});
```

> [!IMPORTANT]
> Key differences from the original plan:
> - Uses `AuthRequest` instead of `Request` — no `(req as any)` casts
> - Wraps each handler in `asyncHandler()` — unhandled errors flow to global error middleware
> - Checks `req.user!.roles?.includes('ADMIN')` instead of `user.roles?.some((r: any) => r.name === 'Admin')` — the `AuthRequest.roles` field is already an array of role name strings (see [auth.middleware.ts:81](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/middleware/auth.middleware.ts#L81))

**Task 3, Step 2 — `deviceToken.middleware.ts` (lines 324–341):** Fix typing:

```diff
-import { Request, Response, NextFunction } from 'express';
+import { Response, NextFunction } from 'express';
+import { AuthRequest } from '../middleware/auth.middleware';
 import { mobileDeviceService } from '../services/mobileDevice.service';

-export const validateDeviceToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
+export const validateDeviceToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
   const deviceToken = req.headers['x-device-token'] as string | undefined;
   if (!deviceToken) { next(); return; }

   const revoked = await mobileDeviceService.isRevoked(deviceToken);
   if (revoked) {
     res.status(401).json({ status: 'error', message: 'Device session revoked' });
     return;
   }

   mobileDeviceService.touchLastSeen(deviceToken); // fire-and-forget
-  (req as any).deviceToken = deviceToken;
+  // Attach to request for downstream use — extend AuthRequest if needed
+  (req as any).deviceToken = deviceToken;
   next();
 };
```

**Task 6, Step 2 — `applicationBorrowerLink.controller.ts` (lines 639–661):** Full replacement:

```typescript
// backend/src/credit/controllers/applicationBorrowerLink.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { applicationBorrowerLinkService } from '../services/applicationBorrowerLink.service';

export const linkApplication = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { referenceNumber } = req.body;

  if (!referenceNumber || typeof referenceNumber !== 'string') {
    res.status(400).json({ status: 'error', message: 'referenceNumber is required' });
    return;
  }

  const result = await applicationBorrowerLinkService.linkByApplicationNo(
    userId, referenceNumber.trim().toUpperCase()
  );
  res.status(201).json({ status: 'success', data: result });
});

export const getMyApplications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const links = await applicationBorrowerLinkService.getLinkedApplications(req.user!.id);
  res.json({ status: 'success', data: { applications: links.map(l => l.application) } });
});
```

---

### Fix 5 — CORS: Allow `X-Device-Token` header 🟠

**Problem:** [app.ts:37](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/app.ts#L37) only allows `Content-Type` and `Authorization`. The Flutter client sends `X-Device-Token` on every request — CORS preflight will strip it.

**Impact:** Plan Tasks 3, 9 (entire device trust flow)

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 3:** Add a new step after Step 4 (before Step 5 commit):

> **Step 4b: Add X-Device-Token to CORS allowedHeaders**
>
> In `backend/src/app.ts`, update the CORS config:
> ```diff
>  allowedHeaders: ['Content-Type', 'Authorization'],
> +allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token'],
>  ```

---

### Fix 6 — Feature flag: Mount borrower routes before staff gate 🟠

**Problem:** [credit.routes.ts:127-128](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/src/credit/routes/credit.routes.ts#L127-L128) applies `authenticate` + `requireFeatureFlag('credit:module')` globally. Borrower routes mounted after this block will require the staff feature flag, which borrowers won't have.

**Impact:** Plan Task 6

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 6, Step 4 (lines 679–694):** Replace instruction with precise placement:

```diff
-In `backend/src/credit/routes/credit.routes.ts`, add after existing imports:
+In `backend/src/credit/routes/credit.routes.ts`:
+
+1. Add import at the top with other imports:
 import applicationBorrowerLinkRoutes from './applicationBorrowerLink.routes';

-Add before `export default router`:
-// Borrower self-service routes
-router.use(applicationBorrowerLinkRoutes);
-Place this BEFORE the `router.use(authenticate)` + `router.use(requireFeatureFlag(...))` block

+2. Mount BETWEEN the feature-flag admin block (line 124) and the authenticate gate (line 127):
+
+// Borrower self-service routes (own authenticate — no feature flag required)
+router.use(applicationBorrowerLinkRoutes);
+
+// All routes below require authentication + feature flag
+router.use(authenticate);
+router.use(requireFeatureFlag('credit:module'));
```

> [!NOTE]
> The borrower route file ([applicationBorrowerLink.routes.ts](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md#L666-L677)) already includes its own `authenticate` + `requirePermission('credit:borrower')` middleware, so no auth bypass occurs.

---

### Fix 7 — Seed: Add required `resource`/`action` fields + role mapping 🟠

**Problem:** The `Permission` model has non-nullable `resource` and `action` columns ([schema.prisma:237-239](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/schema.prisma#L237-L239)). The plan's seed entry omits them. Also, no role is mapped to this permission.

**Impact:** Plan Task 6

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 6, Step 5 (lines 696–701):** Replace with full seed patch:

```diff
-In `backend/prisma/seed.ts`, find the permissions array and add:
-{ name: 'credit:borrower', description: '...' },
+In `backend/prisma/seed.ts`:
+
+1. Add to the `permissions` array (after the existing credit permissions, ~line 269):
+{ name: 'credit:borrower', resource: 'credit', action: 'borrower', description: 'Borrower self-service: link application, upload documents, view own application status' },
+
+2. Add a new BORROWER role upsert (after the CREDIT_OPS role, ~line 217):
+await prisma.role.upsert({
+    where: { name: 'BORROWER' },
+    update: {},
+    create: { name: 'BORROWER', description: 'External borrower — self-service access to linked applications' },
+});
+
+3. Add to the `rolePermissionMap` (after CREDIT_OPS entry, ~line 372):
+BORROWER: ['credit:borrower'],
```

---

### Fix 8 — Flutter: `ApplicationState` enum missing `REFERRED_BACK` 🟡

**Problem:** The backend enum has [`REFERRED_BACK`](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend/prisma/schema.prisma#L2513) but the Flutter model doesn't include it. This will cause the `fromString` fallback to incorrectly map it to `draft`.

**Impact:** Plan Task 12

#### [MODIFY] [2026-06-05-flutter-credit-p1-foundation.md](file:///Users/fangkaryuan/cwc2.0/citadel-cwc-portal/docs/superpowers/plans/2026-06-05-flutter-credit-p1-foundation.md)

**Task 12 (line 1406):** Add the missing variant:

```diff
   draft, submitted, kycReview, kycApproved, kycRejected,
   underwriting, creditAssessment, committeeReview,
-  approved, rejected, offer, accepted, disbursed, active, closed, withdrawn;
+  approved, rejected, offer, accepted, disbursed, active, closed, withdrawn, referredBack;
```

And add to the `fromString` map (after `WITHDRAWN`, ~line 1425):

```diff
       'WITHDRAWN': ApplicationState.withdrawn,
+      'REFERRED_BACK': ApplicationState.referredBack,
```

And add to the `label` map (after `withdrawn`, ~line 1447):

```diff
       ApplicationState.withdrawn: 'Withdrawn',
+      ApplicationState.referredBack: 'Referred Back',
```

---

## Verification Plan

### Automated Tests

After applying all fixes to the plan document:

```bash
# 1. Validate that the corrected Prisma schema compiles
cd backend && npx prisma validate

# 2. Run existing tests to verify no regressions
cd backend && npm test

# 3. After Flutter project creation, verify analyze passes
cd cwc_mobile && flutter analyze
```

### Manual Verification

1. **Schema review:** Search the corrected plan for any remaining occurrences of `referenceNumber`, `totalFacilityAmount`, or `cuid()` — there should be zero
2. **Controller review:** Search for `(req as any).user` — should only appear in `deviceToken.middleware.ts` (for the `deviceToken` property which isn't part of `AuthRequest`)
3. **Seed review:** Verify the corrected seed entry has all 4 fields (`name`, `resource`, `action`, `description`) and a matching `rolePermissionMap` entry
4. **Dry-run:** Have an implementing agent execute Task 1 (schema) + Task 6 (borrower link) against a branch and verify `npx prisma validate` + `npm run prisma:seed` succeed

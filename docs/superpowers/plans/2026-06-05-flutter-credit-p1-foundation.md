# Flutter Credit Mobile App — P1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Flutter monorepo with two build flavors, implement the shared core layer (Dio API client, JWT + device trust auth, biometric, FCM push), and add the required backend endpoints (device registration/revocation, FCM service, borrower application linking).

**Architecture:** Flutter multi-entry-point project (`main_staff.dart` / `main_borrower.dart`) with a shared `lib/core/` package. Riverpod for state management, Dio for HTTP with automatic JWT refresh. Backend additions: one new Prisma model (`MobileDevice`), one join model (`ApplicationBorrowerLink`), three new REST endpoints, and an FCM push service wrapping the existing notification system.

**Tech Stack:** Flutter 3.19+, Dart 3.3+, flutter_riverpod 2.5.1, Dio 5.4.3, go_router 13.2.0, flutter_secure_storage 9.2.2, local_auth 2.2.0, firebase_messaging 14.9.4, firebase_core 3.3.0, Node.js/Express/TypeScript, Prisma 5, PostgreSQL, Firebase Cloud Messaging

**Spec:** `docs/superpowers/specs/2026-06-05-flutter-credit-mobile-app-design.md`

---

## File Map

### Backend (new/modified)
- `backend/prisma/schema.prisma` — add `MobileDevice`, `ApplicationBorrowerLink` models
- `backend/src/services/mobileDevice.service.ts` — device CRUD
- `backend/src/controllers/mobileDevice.controller.ts` — register/revoke handlers
- `backend/src/routes/auth.routes.ts` — add mobile device sub-routes
- `backend/src/services/fcm.service.ts` — Firebase Admin SDK wrapper
- `backend/src/credit/services/creditPush.service.ts` — credit-specific push triggers
- `backend/src/credit/services/applicationBorrowerLink.service.ts`
- `backend/src/credit/controllers/applicationBorrowerLink.controller.ts`
- `backend/src/credit/routes/applicationBorrowerLink.routes.ts`
- `backend/src/credit/routes/credit.routes.ts` — mount borrower link route
- `backend/prisma/seed.ts` — add `credit:borrower` permission

### Flutter (new project at `cwc_mobile/`)
- `cwc_mobile/pubspec.yaml`
- `cwc_mobile/lib/core/flavor/flavor_config.dart`
- `cwc_mobile/lib/main_staff.dart`
- `cwc_mobile/lib/main_borrower.dart`
- `cwc_mobile/lib/core/storage/secure_storage.dart`
- `cwc_mobile/lib/core/api/api_client.dart`
- `cwc_mobile/lib/core/api/endpoints.dart`
- `cwc_mobile/lib/core/auth/auth_models.dart`
- `cwc_mobile/lib/core/auth/auth_service.dart`
- `cwc_mobile/lib/core/auth/device_service.dart`
- `cwc_mobile/lib/core/auth/auth_provider.dart`
- `cwc_mobile/lib/core/models/credit_models.dart`
- `cwc_mobile/lib/core/theme/app_theme.dart`
- `cwc_mobile/lib/core/widgets/loading_overlay.dart`
- `cwc_mobile/lib/core/widgets/error_state.dart`
- `cwc_mobile/lib/staff/app.dart`
- `cwc_mobile/lib/staff/router.dart`
- `cwc_mobile/lib/borrower/app.dart`
- `cwc_mobile/lib/borrower/router.dart`

---

## Task 1: Backend — MobileDevice + ApplicationBorrowerLink Prisma models

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Open `backend/prisma/schema.prisma`. After the `User` model's relations block (around line 190), add:

```prisma
model MobileDevice {
  id           String    @id @default(cuid())
  userId       String    @map("user_id")
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceToken  String    @unique @map("device_token")
  platform     String    @db.VarChar(10)
  fcmToken     String?   @map("fcm_token")
  lastSeenAt   DateTime  @default(now()) @map("last_seen_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  @@map("mobile_devices")
}

model ApplicationBorrowerLink {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  applicationId String   @map("application_id")
  createdAt     DateTime @default(now()) @map("created_at")

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  application CreditApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([userId, applicationId])
  @@map("application_borrower_links")
}
```

Also add to the `User` model relations block:
```prisma
  mobileDevices         MobileDevice[]
  borrowerLinks         ApplicationBorrowerLink[]
```

Also add to the `CreditApplication` model relations block:
```prisma
  borrowerLinks         ApplicationBorrowerLink[]
```

- [ ] **Step 2: Add referenceNumber field to CreditApplication**

In the `CreditApplication` model, add after the `id` field:
```prisma
  referenceNumber  String?  @unique @map("reference_number") @db.VarChar(30)
```

- [ ] **Step 3: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_mobile_device_borrower_link
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 4: Verify schema compiles**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(db): add MobileDevice, ApplicationBorrowerLink, referenceNumber to CreditApplication"
```

---

## Task 2: Backend — mobileDevice.service.ts

**Files:**
- Create: `backend/src/services/mobileDevice.service.ts`

- [ ] **Step 1: Write the service**

```typescript
// backend/src/services/mobileDevice.service.ts
import prisma from '../utils/prisma';

export interface RegisterDeviceInput {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
  fcmToken?: string;
}

export const mobileDeviceService = {
  async register(input: RegisterDeviceInput) {
    return prisma.mobileDevice.upsert({
      where: { deviceToken: input.deviceToken },
      update: {
        fcmToken: input.fcmToken,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
      create: {
        userId: input.userId,
        deviceToken: input.deviceToken,
        platform: input.platform,
        fcmToken: input.fcmToken,
      },
    });
  },

  async revoke(deviceToken: string) {
    return prisma.mobileDevice.update({
      where: { deviceToken },
      data: { revokedAt: new Date() },
    });
  },

  async isRevoked(deviceToken: string): Promise<boolean> {
    const device = await prisma.mobileDevice.findUnique({
      where: { deviceToken },
      select: { revokedAt: true },
    });
    return device == null || device.revokedAt != null;
  },

  async touchLastSeen(deviceToken: string) {
    await prisma.mobileDevice.update({
      where: { deviceToken },
      data: { lastSeenAt: new Date() },
    }).catch(() => { /* ignore if not found */ });
  },

  async getByUserId(userId: string) {
    return prisma.mobileDevice.findMany({
      where: { userId, revokedAt: null },
      select: { deviceToken: true, platform: true, lastSeenAt: true, createdAt: true },
    });
  },
};
```

- [ ] **Step 2: Write tests**

Create `backend/src/__tests__/mobileDevice.service.test.ts`:

```typescript
import { mobileDeviceService } from '../services/mobileDevice.service';
import prisma from '../utils/prisma';

jest.mock('../utils/prisma', () => ({
  mobileDevice: {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('mobileDeviceService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('register upserts device and clears revokedAt', async () => {
    (mockPrisma.mobileDevice.upsert as jest.Mock).mockResolvedValue({ id: '1' });
    await mobileDeviceService.register({ userId: 'u1', deviceToken: 'tok', platform: 'ios' });
    expect(mockPrisma.mobileDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ revokedAt: null }) })
    );
  });

  it('isRevoked returns true when device not found', async () => {
    (mockPrisma.mobileDevice.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await mobileDeviceService.isRevoked('tok')).toBe(true);
  });

  it('isRevoked returns false for active device', async () => {
    (mockPrisma.mobileDevice.findUnique as jest.Mock).mockResolvedValue({ revokedAt: null });
    expect(await mobileDeviceService.isRevoked('tok')).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test -- --testPathPattern=mobileDevice.service
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/mobileDevice.service.ts backend/src/__tests__/mobileDevice.service.test.ts
git commit -m "feat(auth): add mobileDevice service"
```

---

## Task 3: Backend — Device registration/revocation controller + routes

**Files:**
- Create: `backend/src/controllers/mobileDevice.controller.ts`
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Write controller**

```typescript
// backend/src/controllers/mobileDevice.controller.ts
import { Request, Response } from 'express';
import { mobileDeviceService } from '../services/mobileDevice.service';

export const registerDevice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { deviceToken, platform, fcmToken } = req.body;

  if (!deviceToken || !platform || !['ios', 'android'].includes(platform)) {
    res.status(400).json({ status: 'error', message: 'deviceToken and platform (ios|android) required' });
    return;
  }

  const device = await mobileDeviceService.register({
    userId: user.id,
    deviceToken,
    platform,
    fcmToken,
  });

  res.status(201).json({ status: 'success', data: { device } });
};

export const revokeDevice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { deviceToken } = req.params;

  // Verify this device belongs to the requesting user
  const devices = await mobileDeviceService.getByUserId(user.id);
  const owns = devices.some(d => d.deviceToken === deviceToken);

  if (!owns) {
    const isAdmin = user.roles?.some((r: any) => r.name === 'Admin');
    if (!isAdmin) {
      res.status(403).json({ status: 'error', message: 'Forbidden' });
      return;
    }
  }

  await mobileDeviceService.revoke(deviceToken);
  res.json({ status: 'success', data: { revoked: true } });
};

export const listDevices = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const devices = await mobileDeviceService.getByUserId(user.id);
  res.json({ status: 'success', data: { devices } });
};
```

- [ ] **Step 2: Add middleware to validate device token on credit routes**

Create `backend/src/middleware/deviceToken.middleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { mobileDeviceService } from '../services/mobileDevice.service';

export const validateDeviceToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const deviceToken = req.headers['x-device-token'] as string | undefined;
  if (!deviceToken) { next(); return; }

  const revoked = await mobileDeviceService.isRevoked(deviceToken);
  if (revoked) {
    res.status(401).json({ status: 'error', message: 'Device session revoked' });
    return;
  }

  mobileDeviceService.touchLastSeen(deviceToken); // fire-and-forget
  (req as any).deviceToken = deviceToken;
  next();
};
```

- [ ] **Step 3: Mount routes in auth.routes.ts**

In `backend/src/routes/auth.routes.ts`, add after existing imports:

```typescript
import { registerDevice, revokeDevice, listDevices } from '../controllers/mobileDevice.controller';
```

Then add these routes before the `export default router` line:

```typescript
// Mobile device trust
router.post('/mobile/register-device', authenticate, registerDevice);
router.delete('/mobile/revoke-device/:deviceToken', authenticate, revokeDevice);
router.get('/mobile/devices', authenticate, listDevices);
```

- [ ] **Step 4: Apply deviceToken middleware to credit routes**

In `backend/src/routes/index.ts` (or wherever credit routes are mounted), import and apply:

```typescript
import { validateDeviceToken } from '../middleware/deviceToken.middleware';
// Apply before credit routes:
app.use('/api/v1/credit', validateDeviceToken);
```

Check existing mounting pattern in `backend/src/app.ts` or `backend/src/routes/index.ts` and add accordingly.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/mobileDevice.controller.ts \
        backend/src/middleware/deviceToken.middleware.ts \
        backend/src/routes/auth.routes.ts
git commit -m "feat(auth): add device registration/revocation endpoints and deviceToken middleware"
```

---

## Task 4: Backend — FCM service

**Files:**
- Create: `backend/src/services/fcm.service.ts`

- [ ] **Step 1: Install Firebase Admin SDK**

```bash
cd backend && npm install firebase-admin
```

Expected: `firebase-admin` added to `package.json`.

- [ ] **Step 2: Add FCM env vars**

In `backend/src/config/index.ts`, add:

```typescript
fcm: {
  projectId: process.env.FIREBASE_PROJECT_ID ?? '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
},
```

In `backend/.env.example`, add:
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

- [ ] **Step 3: Write FCM service**

```typescript
// backend/src/services/fcm.service.ts
import * as admin from 'firebase-admin';
import { config } from '../config';
import prisma from '../utils/prisma';

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.fcm.projectId,
        clientEmail: config.fcm.clientEmail,
        privateKey: config.fcm.privateKey,
      }),
    });
  }
  return app;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const fcmService = {
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!config.fcm.projectId) return; // skip if FCM not configured

    const devices = await prisma.mobileDevice.findMany({
      where: { userId, revokedAt: null, fcmToken: { not: null } },
      select: { fcmToken: true },
    });

    if (devices.length === 0) return;

    const tokens = devices.map(d => d.fcmToken!);
    const messaging = getApp().messaging();

    await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  },

  async sendToMany(userIds: string[], payload: PushPayload): Promise<void> {
    await Promise.allSettled(userIds.map(uid => fcmService.sendToUser(uid, payload)));
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/fcm.service.ts backend/src/config/index.ts backend/.env.example
git commit -m "feat(push): add FCM service with Firebase Admin SDK"
```

---

## Task 5: Backend — Credit push notification service

**Files:**
- Create: `backend/src/credit/services/creditPush.service.ts`

- [ ] **Step 1: Write service**

```typescript
// backend/src/credit/services/creditPush.service.ts
import { fcmService } from '../../services/fcm.service';
import prisma from '../../utils/prisma';

export const creditPushService = {
  /** Notify all approval-eligible users that a new approval is awaiting them */
  async notifyApprovalPending(applicationId: string, approverUserId: string): Promise<void> {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { referenceNumber: true, borrowerProfile: { select: { companyName: true } } },
    });
    if (!app) return;

    const label = app.borrowerProfile?.companyName ?? app.referenceNumber ?? applicationId;
    await fcmService.sendToUser(approverUserId, {
      title: 'Approval Required',
      body: `${label} is awaiting your approval`,
      data: { type: 'APPROVAL_PENDING', applicationId },
    });
  },

  /** Notify borrower when application state changes */
  async notifyBorrowerStateChange(applicationId: string, newState: string): Promise<void> {
    const links = await prisma.applicationBorrowerLink.findMany({
      where: { applicationId },
      select: { userId: true },
    });
    if (links.length === 0) return;

    const stateLabels: Record<string, string> = {
      KYC_REVIEW: 'Your documents are under review',
      KYC_APPROVED: 'KYC approved — underwriting has begun',
      UNDERWRITING: 'Your application is being assessed',
      COMMITTEE_REVIEW: 'Your application is before the credit committee',
      APPROVED: 'Congratulations — your application has been approved',
      REJECTED: 'Your application was not successful',
      OFFER: 'A loan offer is ready for your review',
    };

    const body = stateLabels[newState] ?? `Application status updated to ${newState}`;

    await fcmService.sendToMany(
      links.map(l => l.userId),
      { title: 'Application Update', body, data: { type: 'STATE_CHANGE', applicationId, state: newState } },
    );
  },

  /** Notify borrower when a document is verified or rejected */
  async notifyDocumentStatus(applicationId: string, documentType: string, status: 'VERIFIED' | 'REJECTED'): Promise<void> {
    const links = await prisma.applicationBorrowerLink.findMany({
      where: { applicationId },
      select: { userId: true },
    });
    if (links.length === 0) return;

    const body = status === 'VERIFIED'
      ? `Your ${documentType} document has been verified`
      : `Your ${documentType} document was rejected — please re-upload`;

    await fcmService.sendToMany(
      links.map(l => l.userId),
      { title: 'Document Update', body, data: { type: 'DOCUMENT_STATUS', applicationId, documentType, status } },
    );
  },
};
```

- [ ] **Step 2: Wire into application state change**

In `backend/src/credit/services/creditApplication.service.ts`, find the method that updates application state (look for `state` field update). Import and call:

```typescript
import { creditPushService } from './creditPush.service';

// After saving the new state:
await creditPushService.notifyBorrowerStateChange(applicationId, newState).catch(() => {});
```

Use `.catch(() => {})` — push failures must never break the primary operation.

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/creditPush.service.ts backend/src/credit/services/creditApplication.service.ts
git commit -m "feat(push): add credit push notification service, wire into state changes"
```

---

## Task 6: Backend — ApplicationBorrowerLink endpoint + credit:borrower permission

**Files:**
- Create: `backend/src/credit/services/applicationBorrowerLink.service.ts`
- Create: `backend/src/credit/controllers/applicationBorrowerLink.controller.ts`
- Create: `backend/src/credit/routes/applicationBorrowerLink.routes.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Write service**

```typescript
// backend/src/credit/services/applicationBorrowerLink.service.ts
import prisma from '../../utils/prisma';

export const applicationBorrowerLinkService = {
  async linkByReferenceNumber(userId: string, referenceNumber: string) {
    const application = await prisma.creditApplication.findUnique({
      where: { referenceNumber },
      select: { id: true, referenceNumber: true },
    });

    if (!application) {
      throw Object.assign(new Error('Application not found'), { statusCode: 404 });
    }

    const link = await prisma.applicationBorrowerLink.upsert({
      where: { userId_applicationId: { userId, applicationId: application.id } },
      update: {},
      create: { userId, applicationId: application.id },
    });

    return { link, applicationId: application.id };
  },

  async getLinkedApplications(userId: string) {
    return prisma.applicationBorrowerLink.findMany({
      where: { userId },
      include: {
        application: {
          select: {
            id: true,
            referenceNumber: true,
            state: true,
            productType: true,
            totalFacilityAmount: true,
            currency: true,
            borrowerProfile: { select: { companyName: true } },
          },
        },
      },
    });
  },
};
```

- [ ] **Step 2: Write controller**

```typescript
// backend/src/credit/controllers/applicationBorrowerLink.controller.ts
import { Request, Response } from 'express';
import { applicationBorrowerLinkService } from '../services/applicationBorrowerLink.service';

export const linkApplication = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { referenceNumber } = req.body;

  if (!referenceNumber || typeof referenceNumber !== 'string') {
    res.status(400).json({ status: 'error', message: 'referenceNumber is required' });
    return;
  }

  const result = await applicationBorrowerLinkService.linkByReferenceNumber(user.id, referenceNumber.trim().toUpperCase());
  res.status(201).json({ status: 'success', data: result });
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const links = await applicationBorrowerLinkService.getLinkedApplications(user.id);
  res.json({ status: 'success', data: { applications: links.map(l => l.application) } });
};
```

- [ ] **Step 3: Write route**

```typescript
// backend/src/credit/routes/applicationBorrowerLink.routes.ts
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { linkApplication, getMyApplications } from '../controllers/applicationBorrowerLink.controller';

const router = Router();

router.post('/borrower/link-application', authenticate, requirePermission('credit:borrower'), linkApplication);
router.get('/borrower/my-applications', authenticate, requirePermission('credit:borrower'), getMyApplications);

export default router;
```

- [ ] **Step 4: Mount in credit.routes.ts**

In `backend/src/credit/routes/credit.routes.ts`, add after existing imports:

```typescript
import applicationBorrowerLinkRoutes from './applicationBorrowerLink.routes';
```

Add before `export default router`:

```typescript
// Borrower self-service routes (no feature flag required — borrowers don't hold credit:module)
router.use(applicationBorrowerLinkRoutes);
```

Place this BEFORE the `router.use(authenticate)` + `router.use(requireFeatureFlag(...))` block so borrower routes don't require the staff feature flag.

- [ ] **Step 5: Seed credit:borrower permission**

In `backend/prisma/seed.ts`, find the permissions array and add:

```typescript
{ name: 'credit:borrower', description: 'Borrower self-service: link application, upload documents, view own application status' },
```

- [ ] **Step 6: Run seed**

```bash
cd backend && npm run prisma:seed
```

Expected: seed completes without error; `credit:borrower` permission appears in DB.

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit/services/applicationBorrowerLink.service.ts \
        backend/src/credit/controllers/applicationBorrowerLink.controller.ts \
        backend/src/credit/routes/applicationBorrowerLink.routes.ts \
        backend/src/credit/routes/credit.routes.ts \
        backend/prisma/seed.ts
git commit -m "feat(credit): add borrower application linking endpoint and credit:borrower permission"
```

---

## Task 7: Flutter — Create project + pubspec.yaml + FlavorConfig

**Files:**
- Create: `cwc_mobile/` (new Flutter project)
- Create: `cwc_mobile/pubspec.yaml`
- Create: `cwc_mobile/lib/core/flavor/flavor_config.dart`
- Create: `cwc_mobile/lib/main_staff.dart`
- Create: `cwc_mobile/lib/main_borrower.dart`

- [ ] **Step 1: Create Flutter project**

```bash
cd /path/to/citadel-cwc-portal
flutter create --org com.citadelgroup --project-name cwc_mobile cwc_mobile
cd cwc_mobile
```

Expected: Flutter project scaffold created with `lib/main.dart`, `android/`, `ios/`, `test/`.

- [ ] **Step 2: Replace pubspec.yaml**

```yaml
name: cwc_mobile
description: CWC Credit Mobile App
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.3.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Navigation
  go_router: ^13.2.0

  # HTTP
  dio: ^5.4.3

  # Secure storage + biometric
  flutter_secure_storage: ^9.2.2
  local_auth: ^2.2.0

  # Firebase push
  firebase_core: ^3.3.0
  firebase_messaging: ^14.9.4

  # Device info (for device UUID)
  device_info_plus: ^10.1.0
  uuid: ^4.4.2

  # UI
  cached_network_image: ^3.3.1
  file_picker: ^8.0.7
  image_picker: ^1.1.2
  flutter_pdfview: ^1.3.2
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  mockito: ^5.4.4
  build_runner: ^2.4.9
  riverpod_generator: ^2.4.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
```

- [ ] **Step 3: Create assets directories**

```bash
mkdir -p cwc_mobile/assets/images cwc_mobile/assets/icons
```

- [ ] **Step 4: Create FlavorConfig**

```dart
// cwc_mobile/lib/core/flavor/flavor_config.dart
enum Flavor { staff, borrower }

class FlavorConfig {
  final Flavor flavor;
  final String appName;
  final String baseUrl;

  const FlavorConfig({
    required this.flavor,
    required this.appName,
    required this.baseUrl,
  });

  static late FlavorConfig instance;

  bool get isStaff => flavor == Flavor.staff;
  bool get isBorrower => flavor == Flavor.borrower;
}
```

- [ ] **Step 5: Create main_staff.dart**

```dart
// cwc_mobile/lib/main_staff.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/flavor/flavor_config.dart';
import 'staff/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlavorConfig.instance = const FlavorConfig(
    flavor: Flavor.staff,
    appName: 'CWC Credit',
    baseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/api/v1'),
  );

  await Firebase.initializeApp();

  runApp(const ProviderScope(child: StaffApp()));
}
```

- [ ] **Step 6: Create main_borrower.dart**

```dart
// cwc_mobile/lib/main_borrower.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/flavor/flavor_config.dart';
import 'borrower/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlavorConfig.instance = const FlavorConfig(
    flavor: Flavor.borrower,
    appName: 'CWC Borrower',
    baseUrl: String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/api/v1'),
  );

  await Firebase.initializeApp();

  runApp(const ProviderScope(child: BorrowerApp()));
}
```

- [ ] **Step 7: Install dependencies**

```bash
cd cwc_mobile && flutter pub get
```

Expected: all packages resolved, no version conflicts.

- [ ] **Step 8: Commit**

```bash
git add cwc_mobile/
git commit -m "feat(mobile): scaffold Flutter project with staff/borrower flavors"
```

---

## Task 8: Flutter — core/storage/secure_storage.dart

**Files:**
- Create: `cwc_mobile/lib/core/storage/secure_storage.dart`
- Create: `cwc_mobile/test/core/storage/secure_storage_test.dart`

- [ ] **Step 1: Write secure storage wrapper**

```dart
// cwc_mobile/lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyDeviceToken = 'device_token';
  static const _keyUserId = 'user_id';

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    await Future.wait([
      _storage.write(key: _keyAccessToken, value: accessToken),
      _storage.write(key: _keyRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: _keyAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);

  Future<void> saveDeviceToken(String token) => _storage.write(key: _keyDeviceToken, value: token);
  Future<String?> getDeviceToken() => _storage.read(key: _keyDeviceToken);

  Future<void> saveUserId(String id) => _storage.write(key: _keyUserId, value: id);
  Future<String?> getUserId() => _storage.read(key: _keyUserId);

  Future<void> clearAll() => _storage.deleteAll();
}
```

- [ ] **Step 2: Write Riverpod provider**

Create `cwc_mobile/lib/core/storage/storage_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'secure_storage.dart';

final secureStorageProvider = Provider<SecureStorage>((ref) {
  return SecureStorage(const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  ));
});
```

- [ ] **Step 3: Commit**

```bash
git add cwc_mobile/lib/core/storage/
git commit -m "feat(mobile/core): add SecureStorage wrapper"
```

---

## Task 9: Flutter — core/api/api_client.dart

**Files:**
- Create: `cwc_mobile/lib/core/api/api_client.dart`
- Create: `cwc_mobile/lib/core/api/endpoints.dart`
- Create: `cwc_mobile/lib/core/api/api_provider.dart`

- [ ] **Step 1: Write endpoints constants**

```dart
// cwc_mobile/lib/core/api/endpoints.dart
class Endpoints {
  static const auth = '/auth';
  static const login = '/auth/login';
  static const refresh = '/auth/refresh';
  static const registerDevice = '/auth/mobile/register-device';
  static const revokeDevice = '/auth/mobile/revoke-device';
  static const creditApplications = '/credit/applications';
  static const creditBorrowers = '/credit/borrowers';
  static const creditDashboard = '/credit/dashboard';
  static const creditApprovals = '/credit/approvals';
  static const creditCommittee = '/credit/committee';
  static const creditDocuments = '/credit/documents';
  static const borrowerLink = '/credit/borrower/link-application';
  static const borrowerApplications = '/credit/borrower/my-applications';
}
```

- [ ] **Step 2: Write Dio API client with JWT interceptor**

```dart
// cwc_mobile/lib/core/api/api_client.dart
import 'package:dio/dio.dart';
import '../flavor/flavor_config.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: FlavorConfig.instance.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  final SecureStorage _storage;
  late final Dio _dio;
  bool _refreshing = false;

  Dio get dio => _dio;

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    final deviceToken = await _storage.getDeviceToken();
    if (deviceToken != null) {
      options.headers['X-Device-Token'] = deviceToken;
    }
    handler.next(options);
  }

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_refreshing) {
      _refreshing = true;
      try {
        final refreshToken = await _storage.getRefreshToken();
        if (refreshToken == null) { handler.next(err); return; }

        final refreshDio = Dio(BaseOptions(baseUrl: FlavorConfig.instance.baseUrl));
        final res = await refreshDio.post('/auth/refresh', data: {'refreshToken': refreshToken});
        final newAccess = res.data['data']['accessToken'] as String;
        final newRefresh = res.data['data']['refreshToken'] as String;
        await _storage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);

        // Retry original request
        final retryOptions = err.requestOptions..headers['Authorization'] = 'Bearer $newAccess';
        final retryRes = await _dio.fetch(retryOptions);
        handler.resolve(retryRes);
      } catch (_) {
        await _storage.clearAll();
        handler.next(err);
      } finally {
        _refreshing = false;
      }
    } else {
      handler.next(err);
    }
  }

  // Convenience methods
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _dio.get(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(String path, {dynamic data}) => _dio.post(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) => _dio.patch(path, data: data);

  Future<Response<T>> delete<T>(String path) => _dio.delete(path);

  Future<Response<T>> postFormData<T>(String path, FormData formData) =>
      _dio.post(path, data: formData);
}
```

- [ ] **Step 3: Write Riverpod provider**

```dart
// cwc_mobile/lib/core/api/api_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../storage/storage_provider.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(storage);
});
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/core/api/
git commit -m "feat(mobile/core): add Dio API client with JWT refresh interceptor"
```

---

## Task 10: Flutter — core/auth/auth_service.dart

**Files:**
- Create: `cwc_mobile/lib/core/auth/auth_models.dart`
- Create: `cwc_mobile/lib/core/auth/auth_service.dart`
- Create: `cwc_mobile/lib/core/auth/auth_provider.dart`

- [ ] **Step 1: Write auth models**

```dart
// cwc_mobile/lib/core/auth/auth_models.dart
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.permissions,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final List<String> permissions;

  String get fullName => '$firstName $lastName';
  bool hasPermission(String perm) => permissions.contains(perm);

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? []);
    final perms = roles
        .expand((r) => (r['permissions'] as List<dynamic>? ?? []))
        .map((p) => p['name'] as String)
        .toSet()
        .toList();

    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      permissions: perms,
    );
  }
}

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({required this.status, this.user});
  final AuthStatus status;
  final AuthUser? user;
}
```

- [ ] **Step 2: Write auth service**

```dart
// cwc_mobile/lib/core/auth/auth_service.dart
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../storage/secure_storage.dart';
import 'auth_models.dart';

class AuthService {
  AuthService(this._api, this._storage);

  final ApiClient _api;
  final SecureStorage _storage;

  Future<AuthUser> login(String email, String password) async {
    final res = await _api.post(Endpoints.login, data: {'email': email, 'password': password});
    final data = res.data['data'] as Map<String, dynamic>;
    await _storage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    await _storage.saveUserId(user.id);
    return user;
  }

  Future<void> logout() async {
    await _storage.clearAll();
  }

  Future<AuthUser?> restoreSession() async {
    final token = await _storage.getAccessToken();
    if (token == null) return null;

    try {
      final res = await _api.get('/auth/me');
      return AuthUser.fromJson(res.data['data']['user'] as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<AuthUser> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String userType = 'BORROWER',
  }) async {
    final res = await _api.post('/auth/register', data: {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
      'userType': userType,
    });
    final data = res.data['data'] as Map<String, dynamic>;
    await _storage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    return AuthUser.fromJson(data['user'] as Map<String, dynamic>);
  }
}
```

- [ ] **Step 3: Write Riverpod auth provider**

```dart
// cwc_mobile/lib/core/auth/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_provider.dart';
import '../storage/storage_provider.dart';
import 'auth_models.dart';
import 'auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.watch(apiClientProvider), ref.watch(secureStorageProvider));
});

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final service = ref.read(authServiceProvider);
    final user = await service.restoreSession();
    return AuthState(
      status: user != null ? AuthStatus.authenticated : AuthStatus.unauthenticated,
      user: user,
    );
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final service = ref.read(authServiceProvider);
      final user = await service.login(email, password);
      return AuthState(status: AuthStatus.authenticated, user: user);
    });
  }

  Future<void> logout() async {
    await ref.read(authServiceProvider).logout();
    state = const AsyncValue.data(AuthState(status: AuthStatus.unauthenticated));
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
```

- [ ] **Step 4: Commit**

```bash
git add cwc_mobile/lib/core/auth/
git commit -m "feat(mobile/core): add auth models, service, and Riverpod provider"
```

---

## Task 11: Flutter — core/auth/device_service.dart

**Files:**
- Create: `cwc_mobile/lib/core/auth/device_service.dart`
- Create: `cwc_mobile/lib/core/auth/device_provider.dart`

- [ ] **Step 1: Write device service**

```dart
// cwc_mobile/lib/core/auth/device_service.dart
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../storage/secure_storage.dart';

class DeviceService {
  DeviceService(this._api, this._storage);

  final ApiClient _api;
  final SecureStorage _storage;
  final _localAuth = LocalAuthentication();

  Future<String> getOrCreateDeviceToken() async {
    final existing = await _storage.getDeviceToken();
    if (existing != null) return existing;

    final token = const Uuid().v4();
    await _storage.saveDeviceToken(token);
    return token;
  }

  Future<void> registerWithServer() async {
    final deviceToken = await getOrCreateDeviceToken();
    final fcmToken = await FirebaseMessaging.instance.getToken();
    final platform = Platform.isIOS ? 'ios' : 'android';

    await _api.post(Endpoints.registerDevice, data: {
      'deviceToken': deviceToken,
      'platform': platform,
      'fcmToken': fcmToken,
    });
  }

  Future<bool> canUseBiometrics() async {
    final canCheck = await _localAuth.canCheckBiometrics;
    final isAvailable = await _localAuth.isDeviceSupported();
    return canCheck && isAvailable;
  }

  Future<bool> authenticateWithBiometrics() async {
    try {
      return await _localAuth.authenticate(
        localizedReason: 'Authenticate to access CWC Credit',
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
    } catch (_) {
      return false;
    }
  }

  Future<void> revokeDevice() async {
    final token = await _storage.getDeviceToken();
    if (token == null) return;
    await _api.delete('${Endpoints.revokeDevice}/$token');
    await _storage.clearAll();
  }
}
```

- [ ] **Step 2: Write Riverpod provider**

```dart
// cwc_mobile/lib/core/auth/device_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_provider.dart';
import '../storage/storage_provider.dart';
import 'device_service.dart';

final deviceServiceProvider = Provider<DeviceService>((ref) {
  return DeviceService(ref.watch(apiClientProvider), ref.watch(secureStorageProvider));
});
```

- [ ] **Step 3: Configure iOS for biometric**

In `cwc_mobile/ios/Runner/Info.plist`, add:
```xml
<key>NSFaceIDUsageDescription</key>
<string>CWC Credit uses Face ID to keep your financial data secure</string>
```

- [ ] **Step 4: Configure Android for biometric**

In `cwc_mobile/android/app/src/main/AndroidManifest.xml`, add inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC"/>
<uses-permission android:name="android.permission.USE_FINGERPRINT"/>
```

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/core/auth/device_service.dart \
        cwc_mobile/lib/core/auth/device_provider.dart \
        cwc_mobile/ios/Runner/Info.plist \
        cwc_mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile/core): add device service with FCM registration and biometric auth"
```

---

## Task 12: Flutter — core/models/credit_models.dart

**Files:**
- Create: `cwc_mobile/lib/core/models/credit_models.dart`

- [ ] **Step 1: Write core credit models**

```dart
// cwc_mobile/lib/core/models/credit_models.dart

// Application state matching backend ApplicationState enum
enum ApplicationState {
  draft, submitted, kycReview, kycApproved, kycRejected,
  underwriting, creditAssessment, committeeReview,
  approved, rejected, offer, accepted, disbursed, active, closed, withdrawn;

  static ApplicationState fromString(String s) {
    const map = {
      'DRAFT': ApplicationState.draft,
      'SUBMITTED': ApplicationState.submitted,
      'KYC_REVIEW': ApplicationState.kycReview,
      'KYC_APPROVED': ApplicationState.kycApproved,
      'KYC_REJECTED': ApplicationState.kycRejected,
      'UNDERWRITING': ApplicationState.underwriting,
      'CREDIT_ASSESSMENT': ApplicationState.creditAssessment,
      'COMMITTEE_REVIEW': ApplicationState.committeeReview,
      'APPROVED': ApplicationState.approved,
      'REJECTED': ApplicationState.rejected,
      'OFFER': ApplicationState.offer,
      'ACCEPTED': ApplicationState.accepted,
      'DISBURSED': ApplicationState.disbursed,
      'ACTIVE': ApplicationState.active,
      'CLOSED': ApplicationState.closed,
      'WITHDRAWN': ApplicationState.withdrawn,
    };
    return map[s] ?? ApplicationState.draft;
  }

  String get label {
    const labels = {
      ApplicationState.draft: 'Draft',
      ApplicationState.submitted: 'Submitted',
      ApplicationState.kycReview: 'KYC Review',
      ApplicationState.kycApproved: 'KYC Approved',
      ApplicationState.kycRejected: 'KYC Rejected',
      ApplicationState.underwriting: 'Underwriting',
      ApplicationState.creditAssessment: 'Credit Assessment',
      ApplicationState.committeeReview: 'Committee Review',
      ApplicationState.approved: 'Approved',
      ApplicationState.rejected: 'Rejected',
      ApplicationState.offer: 'Offer Ready',
      ApplicationState.accepted: 'Accepted',
      ApplicationState.disbursed: 'Disbursed',
      ApplicationState.active: 'Active',
      ApplicationState.closed: 'Closed',
      ApplicationState.withdrawn: 'Withdrawn',
    };
    return labels[this] ?? name;
  }
}

class CreditUserRef {
  const CreditUserRef({required this.id, required this.firstName, required this.lastName, required this.email});
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  String get fullName => '$firstName $lastName';

  factory CreditUserRef.fromJson(Map<String, dynamic> j) => CreditUserRef(
    id: j['id'] as String, firstName: j['firstName'] as String,
    lastName: j['lastName'] as String, email: j['email'] as String? ?? '',
  );
}

class BorrowerSummary {
  const BorrowerSummary({required this.id, required this.companyName});
  final String id;
  final String companyName;
  factory BorrowerSummary.fromJson(Map<String, dynamic> j) =>
      BorrowerSummary(id: j['id'] as String, companyName: j['companyName'] as String? ?? '');
}

class CreditApplication {
  const CreditApplication({
    required this.id,
    required this.state,
    this.referenceNumber,
    this.productType,
    this.totalFacilityAmount,
    this.currency,
    this.borrowerProfile,
    this.rmUser,
    this.analystUser,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final ApplicationState state;
  final String? referenceNumber;
  final String? productType;
  final double? totalFacilityAmount;
  final String? currency;
  final BorrowerSummary? borrowerProfile;
  final CreditUserRef? rmUser;
  final CreditUserRef? analystUser;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory CreditApplication.fromJson(Map<String, dynamic> j) => CreditApplication(
    id: j['id'] as String,
    state: ApplicationState.fromString(j['state'] as String? ?? 'DRAFT'),
    referenceNumber: j['referenceNumber'] as String?,
    productType: j['productType'] as String?,
    totalFacilityAmount: (j['totalFacilityAmount'] as num?)?.toDouble(),
    currency: j['currency'] as String?,
    borrowerProfile: j['borrowerProfile'] != null
        ? BorrowerSummary.fromJson(j['borrowerProfile'] as Map<String, dynamic>)
        : null,
    rmUser: j['rmUser'] != null ? CreditUserRef.fromJson(j['rmUser'] as Map<String, dynamic>) : null,
    analystUser: j['analystUser'] != null ? CreditUserRef.fromJson(j['analystUser'] as Map<String, dynamic>) : null,
    createdAt: j['createdAt'] != null ? DateTime.tryParse(j['createdAt'] as String) : null,
    updatedAt: j['updatedAt'] != null ? DateTime.tryParse(j['updatedAt'] as String) : null,
  );
}

class ApprovalInboxItem {
  const ApprovalInboxItem({
    required this.application,
    required this.approvalId,
    required this.daysWaiting,
    required this.isUrgent,
  });

  final CreditApplication application;
  final String approvalId;
  final int daysWaiting;
  final bool isUrgent;

  factory ApprovalInboxItem.fromJson(Map<String, dynamic> j) => ApprovalInboxItem(
    application: CreditApplication.fromJson(j['application'] as Map<String, dynamic>? ?? j),
    approvalId: j['approvalId'] as String? ?? j['id'] as String,
    daysWaiting: j['daysWaiting'] as int? ?? 0,
    isUrgent: j['isUrgent'] as bool? ?? false,
  );
}

class CreditDocument {
  const CreditDocument({
    required this.id,
    required this.documentType,
    required this.status,
    this.rejectionReason,
    this.fileName,
    this.uploadedAt,
  });

  final String id;
  final String documentType;
  final String status; // PENDING | VERIFIED | REJECTED
  final String? rejectionReason;
  final String? fileName;
  final DateTime? uploadedAt;

  factory CreditDocument.fromJson(Map<String, dynamic> j) => CreditDocument(
    id: j['id'] as String,
    documentType: j['documentType'] as String,
    status: j['status'] as String? ?? 'PENDING',
    rejectionReason: j['rejectionReason'] as String?,
    fileName: j['fileName'] as String?,
    uploadedAt: j['uploadedAt'] != null ? DateTime.tryParse(j['uploadedAt'] as String) : null,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add cwc_mobile/lib/core/models/
git commit -m "feat(mobile/core): add Dart credit models"
```

---

## Task 13: Flutter — core/theme/app_theme.dart + shared widgets

**Files:**
- Create: `cwc_mobile/lib/core/theme/app_theme.dart`
- Create: `cwc_mobile/lib/core/widgets/loading_overlay.dart`
- Create: `cwc_mobile/lib/core/widgets/error_state.dart`
- Create: `cwc_mobile/lib/core/widgets/state_badge.dart`

- [ ] **Step 1: Write theme**

```dart
// cwc_mobile/lib/core/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF1A3A6B);       // Citadel navy
  static const accent = Color(0xFFD4AF37);         // Gold
  static const success = Color(0xFF2ECC71);
  static const warning = Color(0xFFF39C12);
  static const danger = Color(0xFFE74C3C);
  static const surface = Color(0xFFF8F9FA);
  static const textPrimary = Color(0xFF1A1A2E);
  static const textSecondary = Color(0xFF6C757D);
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardTheme(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.white,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      filled: true,
      fillColor: Colors.white,
    ),
  );
}
```

- [ ] **Step 2: Write shared widgets**

```dart
// cwc_mobile/lib/core/widgets/loading_overlay.dart
import 'package:flutter/material.dart';

class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({super.key, this.message});
  final String? message;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        if (message != null) ...[
          const SizedBox(height: 16),
          Text(message!, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ],
    ),
  );
}
```

```dart
// cwc_mobile/lib/core/widgets/error_state.dart
import 'package:flutter/material.dart';

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ],
      ),
    ),
  );
}
```

```dart
// cwc_mobile/lib/core/widgets/state_badge.dart
import 'package:flutter/material.dart';
import '../models/credit_models.dart';
import '../theme/app_theme.dart';

class StateBadge extends StatelessWidget {
  const StateBadge({super.key, required this.state});
  final ApplicationState state;

  @override
  Widget build(BuildContext context) {
    final (color, bg) = _colors(state);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(state.label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }

  (Color, Color) _colors(ApplicationState s) => switch (s) {
    ApplicationState.approved || ApplicationState.disbursed => (Colors.white, AppColors.success),
    ApplicationState.rejected || ApplicationState.kycRejected => (Colors.white, AppColors.danger),
    ApplicationState.committeeReview || ApplicationState.creditAssessment => (Colors.white, AppColors.primary),
    ApplicationState.offer => (Colors.white, AppColors.accent),
    _ => (AppColors.textPrimary, AppColors.surface),
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add cwc_mobile/lib/core/theme/ cwc_mobile/lib/core/widgets/
git commit -m "feat(mobile/core): add AppTheme and shared widgets (LoadingOverlay, ErrorState, StateBadge)"
```

---

## Task 14: Flutter — Staff app shell + routing

**Files:**
- Create: `cwc_mobile/lib/staff/app.dart`
- Create: `cwc_mobile/lib/staff/router.dart`
- Create: `cwc_mobile/lib/staff/shell/main_shell.dart`

- [ ] **Step 1: Write staff router**

```dart
// cwc_mobile/lib/staff/router.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_provider.dart';
import '../core/auth/auth_models.dart';
import 'shell/main_shell.dart';

// Placeholder screens — replaced in P2
class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen(this.title);
  final String title;
  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: Text(title)), body: Center(child: Text('Coming in P2: $title')));
}

final staffRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (ctx, state) {
      final isAuth = authState.valueOrNull?.status == AuthStatus.authenticated;
      if (!isAuth && state.matchedLocation != '/login') return '/login';
      if (isAuth && state.matchedLocation == '/login') return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const _PlaceholderScreen('Login')),
      ShellRoute(
        builder: (ctx, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const _PlaceholderScreen('Dashboard')),
          GoRoute(path: '/approvals', builder: (_, __) => const _PlaceholderScreen('Approvals')),
          GoRoute(path: '/committee', builder: (_, __) => const _PlaceholderScreen('Committee')),
          GoRoute(path: '/applications', builder: (_, __) => const _PlaceholderScreen('Applications')),
          GoRoute(path: '/borrowers', builder: (_, __) => const _PlaceholderScreen('Borrowers')),
        ],
      ),
    ],
  );
});
```

- [ ] **Step 2: Write main shell (bottom nav)**

```dart
// cwc_mobile/lib/staff/shell/main_shell.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    (icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Dashboard', path: '/dashboard'),
    (icon: Icons.approval_outlined, activeIcon: Icons.approval, label: 'Approvals', path: '/approvals'),
    (icon: Icons.groups_outlined, activeIcon: Icons.groups, label: 'Committee', path: '/committee'),
    (icon: Icons.folder_open_outlined, activeIcon: Icons.folder, label: 'Applications', path: '/applications'),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexWhere((t) => location.startsWith(t.path));

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex < 0 ? 0 : currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs.map((t) => NavigationDestination(
          icon: Icon(t.icon), selectedIcon: Icon(t.activeIcon), label: t.label,
        )).toList(),
      ),
    );
  }
}
```

- [ ] **Step 3: Write staff app root**

```dart
// cwc_mobile/lib/staff/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import 'router.dart';

class StaffApp extends ConsumerWidget {
  const StaffApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(staffRouterProvider);
    return MaterialApp.router(
      title: 'CWC Credit',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

- [ ] **Step 4: Verify staff flavor runs**

```bash
cd cwc_mobile
flutter run --target lib/main_staff.dart --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Expected: app launches, shows bottom nav with 4 tabs, placeholder screens on each tab.

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/staff/
git commit -m "feat(mobile/staff): add staff app shell with bottom nav and placeholder screens"
```

---

## Task 15: Flutter — Borrower app shell + routing

**Files:**
- Create: `cwc_mobile/lib/borrower/app.dart`
- Create: `cwc_mobile/lib/borrower/router.dart`

- [ ] **Step 1: Write borrower router**

```dart
// cwc_mobile/lib/borrower/router.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_provider.dart';
import '../core/auth/auth_models.dart';

class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen(this.title);
  final String title;
  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: Text(title)), body: Center(child: Text('Coming in P3: $title')));
}

final borrowerRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/home',
    redirect: (ctx, state) {
      final isAuth = authState.valueOrNull?.status == AuthStatus.authenticated;
      final onAuthScreen = ['/login', '/register', '/link'].contains(state.matchedLocation);
      if (!isAuth && !onAuthScreen) return '/login';
      if (isAuth && onAuthScreen) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const _PlaceholderScreen('Login')),
      GoRoute(path: '/register', builder: (_, __) => const _PlaceholderScreen('Register')),
      GoRoute(path: '/link', builder: (_, __) => const _PlaceholderScreen('Link Application')),
      GoRoute(path: '/home', builder: (_, __) => const _PlaceholderScreen('My Applications')),
      GoRoute(path: '/application/:id', builder: (_, s) => _PlaceholderScreen('Application ${s.pathParameters["id"]}')),
      GoRoute(path: '/application/:id/documents', builder: (_, s) => _PlaceholderScreen('Documents')),
    ],
  );
});
```

- [ ] **Step 2: Write borrower app root**

```dart
// cwc_mobile/lib/borrower/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import 'router.dart';

class BorrowerApp extends ConsumerWidget {
  const BorrowerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(borrowerRouterProvider);
    return MaterialApp.router(
      title: 'CWC Borrower',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

- [ ] **Step 3: Verify borrower flavor runs**

```bash
cd cwc_mobile
flutter run --target lib/main_borrower.dart --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Expected: app launches, shows placeholder screens for login/register/home.

- [ ] **Step 4: Run Flutter analyze**

```bash
cd cwc_mobile && flutter analyze
```

Expected: no errors. Fix any warnings before proceeding.

- [ ] **Step 5: Commit**

```bash
git add cwc_mobile/lib/borrower/
git commit -m "feat(mobile/borrower): add borrower app shell and routing"
```

---

## P1 Complete — Handoff to P2

At this point:
- ✅ Backend: `MobileDevice` + `ApplicationBorrowerLink` models in DB
- ✅ Backend: Device register/revoke endpoints live
- ✅ Backend: FCM service + credit push notifications wired to state changes
- ✅ Backend: Borrower linking endpoint + `credit:borrower` permission seeded
- ✅ Flutter: Both flavor entry points build and run
- ✅ Flutter: Core layer (API client, auth, device trust, secure storage, models, theme) complete

**Next:** `docs/superpowers/plans/2026-06-05-flutter-credit-p2-staff-mvp.md`

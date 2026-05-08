# Entity-Based Approval Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a general-purpose entity-to-approver routing system so any request type can automatically create parallel approval records based on the requester's subsidiary entity or custom field values they fill in.

**Architecture:** A new `Entity` model holds subsidiary companies with a designated approver. A `RequestTypeEntityRouting` config table lets admins declare which request types trigger entity routing and how (from requester profile or from a custom field). When a ticket is submitted, `EntityRoutingService` reads the config, resolves entity codes to approvers, and creates parallel `RequestApproval` records. The admin console gains an Entities tab and user profiles gain an entity assignment field.

**Tech Stack:** Prisma + PostgreSQL, Express/TypeScript, React 19 + TypeScript + Vite, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | Add `Entity`, `RequestTypeEntityRouting` models; add `entityId` to `User` and `RequestApproval` |
| `backend/src/controllers/entity.controller.ts` | Create | CRUD for entities and routing rules |
| `backend/src/routes/entity.routes.ts` | Create | Mount entity + routing rule endpoints |
| `backend/src/routes/index.ts` | Modify | Mount entity routes |
| `backend/src/services/entityRouting.service.ts` | Create | Resolve entities → approvers → create `RequestApproval` records |
| `backend/src/controllers/request.controller.ts` | Modify | Call `EntityRoutingService` after request creation |
| `frontend/src/services/entity.service.ts` | Create | API calls for entities and routing rules |
| `frontend/src/services/admin.service.ts` | Modify | Add `entityId` to `updateUser` signature |
| `frontend/src/components/admin/adminConstants.ts` | Modify | Add "Entities" tab entry |
| `frontend/src/components/admin/EntitiesTab.tsx` | Create | Entity list + routing rules UI |
| `frontend/src/components/admin/UserAccountsTab.tsx` | Modify | Add Entity column |
| `frontend/src/components/admin/UserEditModal.tsx` | Modify | Add Entity dropdown |
| `frontend/pages/AdminSettings.tsx` | Modify | Render EntitiesTab, pass entities state |

---

## Task 1: Prisma Schema — Entity and Routing Models

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the `Entity` model**

Open `backend/prisma/schema.prisma`. After the `UserRole` model block (around line 106), add:

```prisma
model Entity {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(200)
  code        String   @unique @db.VarChar(50)
  description String?  @db.Text
  approverId  String   @map("approver_id") @db.Uuid
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  // Relations
  approver          User                       @relation("EntityApprover", fields: [approverId], references: [id])
  users             User[]                     @relation("UserEntity")
  routingRules      RequestTypeEntityRouting[]
  requestApprovals  RequestApproval[]          @relation("ApprovalEntity")

  @@map("entities")
  @@index([approverId])
}

model RequestTypeEntityRouting {
  id             String   @id @default(uuid()) @db.Uuid
  requestTypeId  String   @map("request_type_id") @db.Uuid
  routingMode    EntityRoutingMode @map("routing_mode")
  customFieldKey String?  @map("custom_field_key") @db.VarChar(100)
  label          String?  @db.VarChar(200)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  // Relations
  requestType RequestType @relation(fields: [requestTypeId], references: [id], onDelete: Cascade)
  entity      Entity?     @relation(fields: [id], references: [id])

  @@map("request_type_entity_routings")
  @@index([requestTypeId])
}

enum EntityRoutingMode {
  REQUESTER_ENTITY
  CUSTOM_FIELD
}
```

- [ ] **Step 2: Add `entityId` to the `User` model**

In the `User` model block, after the `agentTeam` field (line ~39), add:

```prisma
  entityId      String?   @map("entity_id") @db.Uuid
```

In the Relations section of `User`, add:

```prisma
  entity                User?                        @relation("UserEntity", fields: [entityId], references: [id])
  approverForEntities   Entity[]                     @relation("EntityApprover")
```

After `@@index([managerId])`, add:

```prisma
  @@index([entityId])
```

- [ ] **Step 3: Add `entityId` to `RequestApproval` and fix `RequestTypeEntityRouting` relation**

In `RequestApproval` model, after the `comments` field, add:

```prisma
  entityId      String?   @map("entity_id") @db.Uuid
```

In the Relations section of `RequestApproval`, add:

```prisma
  entity   Entity? @relation("ApprovalEntity", fields: [entityId], references: [id])
```

After `@@index([approverId])`, add:

```prisma
  @@index([entityId])
```

Fix `RequestTypeEntityRouting` — the entity relation there was incorrect in Step 1. Remove that entity relation from `RequestTypeEntityRouting` entirely (it doesn't need a direct FK to Entity; Entity has the `routingRules` backrelation already defined through `requestTypeId`). The corrected model:

```prisma
model RequestTypeEntityRouting {
  id             String            @id @default(uuid()) @db.Uuid
  requestTypeId  String            @map("request_type_id") @db.Uuid
  routingMode    EntityRoutingMode @map("routing_mode")
  customFieldKey String?           @map("custom_field_key") @db.VarChar(100)
  label          String?           @db.VarChar(200)
  isActive       Boolean           @default(true) @map("is_active")
  createdAt      DateTime          @default(now()) @map("created_at") @db.Timestamp(6)

  // Relations
  requestType RequestType @relation(fields: [requestTypeId], references: [id], onDelete: Cascade)

  @@map("request_type_entity_routings")
  @@index([requestTypeId])
}
```

Also add the back-relation on `RequestType`. Find the `RequestType` model and add inside its Relations section:

```prisma
  entityRoutings  RequestTypeEntityRouting[]
```

And update `Entity.routingRules` to remove the incorrect relation — it was pointing to wrong FK. Remove `routingRules RequestTypeEntityRouting[]` from `Entity`. Instead, `Entity` is looked up by code from `customFields` — no direct FK needed.

Final `Entity` relations block:

```prisma
  approver          User                @relation("EntityApprover", fields: [approverId], references: [id])
  users             User[]              @relation("UserEntity")
  requestApprovals  RequestApproval[]   @relation("ApprovalEntity")
```

- [ ] **Step 4: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_entity_approval_routing
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 5: Verify Prisma client compiles**

```bash
cd backend
npm run prisma:generate
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to Entity, RequestTypeEntityRouting, or EntityRoutingMode.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Entity and RequestTypeEntityRouting schema for approval routing"
```

---

## Task 2: Entity CRUD Backend

**Files:**
- Create: `backend/src/controllers/entity.controller.ts`
- Create: `backend/src/routes/entity.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create the entity controller**

Create `backend/src/controllers/entity.controller.ts`:

```typescript
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

class EntityController {
    // ── Entity CRUD ──────────────────────────────────────────────────

    listEntities = asyncHandler(async (_req: AuthRequest, res: Response) => {
        const entities = await prisma.entity.findMany({
            orderBy: { name: 'asc' },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        res.json({ status: 'success', data: { entities } });
    });

    createEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { name, code, description, approverId } = req.body;

        if (!name || !code || !approverId) {
            throw new AppError('name, code, and approverId are required', 400);
        }

        const approver = await prisma.user.findUnique({ where: { id: approverId } });
        if (!approver || !approver.isActive) {
            throw new AppError('Approver user not found or inactive', 400);
        }

        const entity = await prisma.entity.create({
            data: {
                name: name.trim(),
                code: code.trim().toUpperCase(),
                description: description?.trim() || null,
                approverId,
            },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.status(201).json({ status: 'success', data: { entity } });
    });

    updateEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.id);
        const { name, code, description, approverId, isActive } = req.body;

        const existing = await prisma.entity.findUnique({ where: { id } });
        if (!existing) throw new AppError('Entity not found', 404);

        if (approverId) {
            const approver = await prisma.user.findUnique({ where: { id: approverId } });
            if (!approver || !approver.isActive) {
                throw new AppError('Approver user not found or inactive', 400);
            }
        }

        const entity = await prisma.entity.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(code !== undefined && { code: code.trim().toUpperCase() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(approverId !== undefined && { approverId }),
                ...(isActive !== undefined && { isActive }),
            },
            include: {
                approver: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        });

        res.json({ status: 'success', data: { entity } });
    });

    // ── Routing Rules CRUD ───────────────────────────────────────────

    listRoutingRules = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requestTypeId = String(req.params.requestTypeId);

        const rules = await prisma.requestTypeEntityRouting.findMany({
            where: { requestTypeId },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ status: 'success', data: { rules } });
    });

    createRoutingRule = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requestTypeId = String(req.params.requestTypeId);
        const { routingMode, customFieldKey, label } = req.body;

        if (!routingMode || !['REQUESTER_ENTITY', 'CUSTOM_FIELD'].includes(routingMode)) {
            throw new AppError('routingMode must be REQUESTER_ENTITY or CUSTOM_FIELD', 400);
        }
        if (routingMode === 'CUSTOM_FIELD' && !customFieldKey) {
            throw new AppError('customFieldKey is required for CUSTOM_FIELD mode', 400);
        }

        const requestType = await prisma.requestType.findUnique({ where: { id: requestTypeId } });
        if (!requestType) throw new AppError('Request type not found', 404);

        const rule = await prisma.requestTypeEntityRouting.create({
            data: {
                requestTypeId,
                routingMode,
                customFieldKey: customFieldKey?.trim() || null,
                label: label?.trim() || null,
            },
        });

        res.status(201).json({ status: 'success', data: { rule } });
    });

    deleteRoutingRule = asyncHandler(async (req: AuthRequest, res: Response) => {
        const id = String(req.params.ruleId);

        const rule = await prisma.requestTypeEntityRouting.findUnique({ where: { id } });
        if (!rule) throw new AppError('Routing rule not found', 404);

        await prisma.requestTypeEntityRouting.delete({ where: { id } });

        res.json({ status: 'success', data: null });
    });
}

export const entityController = new EntityController();
```

- [ ] **Step 2: Create the entity routes**

Create `backend/src/routes/entity.routes.ts`:

```typescript
import { Router } from 'express';
import { entityController } from '../controllers/entity.controller';
import { authenticate, requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Entity CRUD — admin only
router.get('/', authenticate, requirePermission('admin:manage'), entityController.listEntities);
router.post('/', authenticate, requirePermission('admin:manage'), entityController.createEntity);
router.put('/:id', authenticate, requirePermission('admin:manage'), entityController.updateEntity);

// Routing rules — nested under request types
router.get('/routing-rules/:requestTypeId', authenticate, requirePermission('admin:manage'), entityController.listRoutingRules);
router.post('/routing-rules/:requestTypeId', authenticate, requirePermission('admin:manage'), entityController.createRoutingRule);
router.delete('/routing-rules/:requestTypeId/:ruleId', authenticate, requirePermission('admin:manage'), entityController.deleteRoutingRule);

export default router;
```

- [ ] **Step 3: Mount routes in index.ts**

Open `backend/src/routes/index.ts`. After the existing imports, add:

```typescript
import entityRoutes from './entity.routes';
```

After the last `router.use(...)` line (before `export default router`), add:

```typescript
router.use('/admin/entities', entityRoutes);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors in entity.controller.ts or entity.routes.ts.

- [ ] **Step 5: Start dev server and test endpoints manually**

```bash
cd backend
npm run dev
```

In a separate terminal (replace TOKEN with a valid admin JWT from login):

```bash
# List entities — should return empty array
curl -s -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v1/admin/entities | jq .

# Create an entity
curl -s -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Citadel Malaysia","code":"CIT-MY","approverId":"<admin-user-id>"}' \
  http://localhost:3000/api/v1/admin/entities | jq .
```

Expected: `{"status":"success","data":{"entity":{...}}}` with entity details including approver.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/entity.controller.ts backend/src/routes/entity.routes.ts backend/src/routes/index.ts
git commit -m "feat: add entity and routing rule CRUD endpoints"
```

---

## Task 3: EntityRoutingService — Approval Engine

**Files:**
- Create: `backend/src/services/entityRouting.service.ts`

- [ ] **Step 1: Create the service**

Create `backend/src/services/entityRouting.service.ts`:

```typescript
import { PrismaClient, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface RoutingContext {
    requestId: string;
    requestTypeId: string;
    requesterId: string;
    customFields: Record<string, any>;
}

export async function applyEntityRouting(ctx: RoutingContext): Promise<void> {
    const { requestId, requestTypeId, requesterId, customFields } = ctx;

    // Fetch all active routing rules for this request type
    const rules = await prisma.requestTypeEntityRouting.findMany({
        where: { requestTypeId, isActive: true },
    });

    if (rules.length === 0) return;

    // Collect entity codes to look up
    const entityCodesToResolve: string[] = [];

    for (const rule of rules) {
        if (rule.routingMode === 'REQUESTER_ENTITY') {
            // Look up which entity the requester belongs to
            const requester = await prisma.user.findUnique({
                where: { id: requesterId },
                select: { entityId: true },
            });
            if (!requester?.entityId) {
                console.warn(`[EntityRouting] Requester ${requesterId} has no entityId assigned — skipping REQUESTER_ENTITY rule`);
                continue;
            }
            // Store the entityId directly (we'll resolve by id below)
            entityCodesToResolve.push(`__id:${requester.entityId}`);
        } else if (rule.routingMode === 'CUSTOM_FIELD' && rule.customFieldKey) {
            const code = customFields?.[rule.customFieldKey];
            if (!code) {
                console.warn(`[EntityRouting] customField key "${rule.customFieldKey}" missing or empty — skipping rule`);
                continue;
            }
            entityCodesToResolve.push(String(code).trim().toUpperCase());
        }
    }

    if (entityCodesToResolve.length === 0) return;

    // Deduplicate
    const unique = [...new Set(entityCodesToResolve)];

    // Resolve entities
    const entities = await Promise.all(
        unique.map((codeOrId) => {
            if (codeOrId.startsWith('__id:')) {
                const entityId = codeOrId.replace('__id:', '');
                return prisma.entity.findUnique({
                    where: { id: entityId },
                    select: { id: true, approverId: true, isActive: true },
                });
            }
            return prisma.entity.findUnique({
                where: { code: codeOrId },
                select: { id: true, approverId: true, isActive: true },
            });
        })
    );

    // Create approval records for each resolved entity in parallel
    await Promise.all(
        entities.map(async (entity) => {
            if (!entity) return;
            if (!entity.isActive) {
                console.warn(`[EntityRouting] Entity ${entity.id} is inactive — skipping`);
                return;
            }

            // Avoid duplicate approval records for same entity+request
            const existing = await prisma.requestApproval.findFirst({
                where: { requestId, entityId: entity.id },
            });
            if (existing) return;

            await prisma.requestApproval.create({
                data: {
                    requestId,
                    approverType: 'ENTITY',
                    approverId: entity.approverId,
                    entityId: entity.id,
                    status: ApprovalStatus.PENDING,
                },
            });
        })
    );
}

/**
 * Returns true only when ALL entity approval records for a request are APPROVED.
 * Returns false if any are PENDING or REJECTED.
 */
export async function allEntityApprovalsResolved(requestId: string): Promise<{ allApproved: boolean; anyRejected: boolean }> {
    const approvals = await prisma.requestApproval.findMany({
        where: { requestId, approverType: 'ENTITY' },
        select: { status: true },
    });

    if (approvals.length === 0) return { allApproved: true, anyRejected: false };

    const anyRejected = approvals.some((a) => a.status === ApprovalStatus.REJECTED);
    const allApproved = approvals.every((a) => a.status === ApprovalStatus.APPROVED);

    return { allApproved, anyRejected };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors in `entityRouting.service.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/entityRouting.service.ts
git commit -m "feat: add EntityRoutingService for parallel entity approval creation"
```

---

## Task 4: Hook EntityRoutingService into Request Creation

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Import the service**

Open `backend/src/controllers/request.controller.ts`. At the top of the file, with the other imports, add:

```typescript
import { applyEntityRouting } from '../services/entityRouting.service';
```

- [ ] **Step 2: Call applyEntityRouting after request is saved**

Find the block starting at line ~552 that reads:

```typescript
        // Notify requester
        await notify({
```

Immediately before that block, add:

```typescript
        // Apply entity-based approval routing if configured for this request type
        if (requestTypeId) {
            await applyEntityRouting({
                requestId: request.id,
                requestTypeId,
                requesterId: request.requesterId,
                customFields: (customFields || {}) as Record<string, any>,
            });
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Smoke-test end-to-end**

Start the backend and create a test request via the frontend or curl for a request type that has no routing rules yet. Verify the request still creates successfully with no extra approval records. Then via Prisma Studio (`npm run prisma:studio`), manually add a `RequestTypeEntityRouting` row with `REQUESTER_ENTITY` mode for that request type, assign an entity to the requester user, and create another request — verify a `RequestApproval` row with `approverType = 'ENTITY'` appears.

```bash
cd backend
npm run prisma:studio
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: trigger entity approval routing on request creation"
```

---

## Task 5: Frontend Entity Service

**Files:**
- Create: `frontend/src/services/entity.service.ts`
- Modify: `frontend/src/services/admin.service.ts`

- [ ] **Step 1: Create entity.service.ts**

Create `frontend/src/services/entity.service.ts`:

```typescript
import apiClient from './api';

export interface Entity {
    id: string;
    name: string;
    code: string;
    description: string | null;
    approverId: string;
    isActive: boolean;
    approver: { id: string; firstName: string; lastName: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export interface RoutingRule {
    id: string;
    requestTypeId: string;
    routingMode: 'REQUESTER_ENTITY' | 'CUSTOM_FIELD';
    customFieldKey: string | null;
    label: string | null;
    isActive: boolean;
    createdAt: string;
}

export const entityService = {
    async listEntities(): Promise<Entity[]> {
        const res = await apiClient.get('/admin/entities');
        return res.data.data.entities;
    },

    async createEntity(data: { name: string; code: string; description?: string; approverId: string }): Promise<Entity> {
        const res = await apiClient.post('/admin/entities', data);
        return res.data.data.entity;
    },

    async updateEntity(id: string, data: Partial<{ name: string; code: string; description: string; approverId: string; isActive: boolean }>): Promise<Entity> {
        const res = await apiClient.put(`/admin/entities/${id}`, data);
        return res.data.data.entity;
    },

    async listRoutingRules(requestTypeId: string): Promise<RoutingRule[]> {
        const res = await apiClient.get(`/admin/entities/routing-rules/${requestTypeId}`);
        return res.data.data.rules;
    },

    async createRoutingRule(requestTypeId: string, data: { routingMode: 'REQUESTER_ENTITY' | 'CUSTOM_FIELD'; customFieldKey?: string; label?: string }): Promise<RoutingRule> {
        const res = await apiClient.post(`/admin/entities/routing-rules/${requestTypeId}`, data);
        return res.data.data.rule;
    },

    async deleteRoutingRule(requestTypeId: string, ruleId: string): Promise<void> {
        await apiClient.delete(`/admin/entities/routing-rules/${requestTypeId}/${ruleId}`);
    },
};
```

- [ ] **Step 2: Update admin.service.ts updateUser to include entityId**

Open `frontend/src/services/admin.service.ts`. Find the `updateUser` method signature:

```typescript
    async updateUser(userId: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; department: string; jobTitle: string; isActive: boolean; managerId: string; agentTeam: string }>) {
```

Replace with:

```typescript
    async updateUser(userId: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; department: string; jobTitle: string; isActive: boolean; managerId: string; agentTeam: string; entityId: string | null }>) {
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/entity.service.ts frontend/src/services/admin.service.ts
git commit -m "feat: add frontend entity service and extend updateUser with entityId"
```

---

## Task 6: Entities Admin Tab UI

**Files:**
- Modify: `frontend/src/components/admin/adminConstants.ts`
- Create: `frontend/src/components/admin/EntitiesTab.tsx`
- Modify: `frontend/pages/AdminSettings.tsx`

- [ ] **Step 1: Add Entities tab to adminConstants.ts**

Open `frontend/src/components/admin/adminConstants.ts`. Find the `ADMIN_TABS` array. After the `permissions` entry, add:

```typescript
    { id: 'entities',          label: 'Entities',          icon: 'corporate_fare',  group: 'Configuration' },
```

Update the `AdminTabId` type — it is derived automatically from the `as const` array, so no change needed there.

- [ ] **Step 2: Create EntitiesTab.tsx**

Create `frontend/src/components/admin/EntitiesTab.tsx`:

```tsx
import React, { useState } from 'react';
import { Entity, entityService, RoutingRule } from '../../services/entity.service';

interface EntitiesTabProps {
    entities: Entity[];
    users: { id: string; firstName: string; lastName: string; email: string }[];
    onRefresh: () => void;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ entities, users, onRefresh }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
    const [form, setForm] = useState({ name: '', code: '', description: '', approverId: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openCreate = () => {
        setForm({ name: '', code: '', description: '', approverId: '' });
        setError(null);
        setShowCreateModal(true);
        setEditingEntity(null);
    };

    const openEdit = (entity: Entity) => {
        setForm({
            name: entity.name,
            code: entity.code,
            description: entity.description || '',
            approverId: entity.approverId,
        });
        setError(null);
        setEditingEntity(entity);
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.code || !form.approverId) {
            setError('Name, code, and approver are required.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editingEntity) {
                await entityService.updateEntity(editingEntity.id, form);
            } else {
                await entityService.createEntity(form);
            }
            setShowCreateModal(false);
            onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save entity.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (entity: Entity) => {
        await entityService.updateEntity(entity.id, { isActive: !entity.isActive });
        onRefresh();
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
                <div>
                    <h3 className="font-black text-[#101418]">Subsidiary Entities</h3>
                    <p className="text-xs text-[#44546f] mt-0.5">Each entity has one designated approver for ticket routing.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Entity
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr className="text-[11px] font-black text-[#44546f] uppercase tracking-[0.2em]">
                            <th className="px-8 py-5">Name</th>
                            <th className="px-8 py-5">Code</th>
                            <th className="px-8 py-5">Designated Approver</th>
                            <th className="px-8 py-5">Status</th>
                            <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {entities.map((entity) => (
                            <tr key={entity.id} className={`hover:bg-gray-50/50 transition-colors ${!entity.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-8 py-5 font-bold text-[#101418]">
                                    <div>{entity.name}</div>
                                    {entity.description && <div className="text-xs text-[#44546f] mt-0.5">{entity.description}</div>}
                                </td>
                                <td className="px-8 py-5">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-black rounded-lg font-mono">{entity.code}</span>
                                </td>
                                <td className="px-8 py-5 text-sm text-[#44546f]">
                                    <div className="font-semibold text-[#101418]">{entity.approver.firstName} {entity.approver.lastName}</div>
                                    <div className="text-xs">{entity.approver.email}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${entity.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                        {entity.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(entity)}
                                            className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                            title="Edit entity"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeactivate(entity)}
                                            className={`w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${entity.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-[#44546f] hover:text-emerald-600'}`}
                                            title={entity.isActive ? 'Deactivate' : 'Activate'}
                                        >
                                            <span className="material-symbols-outlined text-xl">{entity.isActive ? 'block' : 'check_circle'}</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {entities.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-8 py-16 text-center text-[#44546f] font-bold">No entities configured yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                            <h2 className="text-lg font-bold text-gray-900">{editingEntity ? 'Edit Entity' : 'Add Entity'}</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entity Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="e.g. Citadel Malaysia"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entity Code *</label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                                    placeholder="e.g. CIT-MY"
                                />
                                <p className="text-xs text-gray-500 mt-1">Used as the value in custom fields (auto-uppercased)</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Optional description"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Designated Approver *</label>
                                <select
                                    value={form.approverId}
                                    onChange={(e) => setForm({ ...form, approverId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Select approver...</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingEntity ? 'Save Changes' : 'Create Entity'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 3: Wire EntitiesTab into AdminSettings.tsx**

Open `frontend/pages/AdminSettings.tsx`.

Add import at the top:
```tsx
import { EntitiesTab } from '../src/components/admin/EntitiesTab';
import { entityService, Entity } from '../src/services/entity.service';
```

Inside the `AdminSettings` component, add state after `const admin = useAdminState();`:
```tsx
    const [entities, setEntities] = useState<Entity[]>([]);

    const fetchEntities = React.useCallback(async () => {
        try {
            const data = await entityService.listEntities();
            setEntities(data);
        } catch {}
    }, []);

    React.useEffect(() => {
        fetchEntities();
    }, [fetchEntities]);
```

In the tab content area (the `{/* Tab Content */}` section), find where existing tabs are rendered using `admin.activeTab === 'users'` etc. Add the entities tab case:

```tsx
                    {admin.activeTab === 'entities' && (
                        <EntitiesTab
                            entities={entities}
                            users={admin.users.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))}
                            onRefresh={fetchEntities}
                        />
                    )}
```

Add `useState` to the React import if not already there: `import React, { useState } from 'react';`

- [ ] **Step 4: Verify frontend builds**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Start frontend dev server and verify Entities tab appears**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`, log in as admin, go to Admin Console. Verify "Entities" tab appears in the sidebar under Configuration. Click it and verify the empty state message shows.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/adminConstants.ts frontend/src/components/admin/EntitiesTab.tsx frontend/pages/AdminSettings.tsx
git commit -m "feat: add Entities admin tab with create/edit/deactivate UI"
```

---

## Task 7: User Profile — Entity Assignment and Approver Badge

**Files:**
- Modify: `frontend/src/components/admin/UserEditModal.tsx`
- Modify: `frontend/src/components/admin/UserAccountsTab.tsx`

- [ ] **Step 1: Add entityId to UserEditModal props and form**

Open `frontend/src/components/admin/UserEditModal.tsx`.

Update the `user` prop interface to include:
```tsx
    entityId?: string | null;
```

Update `formData` state initial value to include:
```tsx
    entityId: '',
```

Update the `useEffect` that populates form from user to include:
```tsx
        entityId: user.entityId || '',
```

Add `entities` prop to `UserEditModalProps`:
```tsx
    entities: { id: string; name: string; code: string }[];
```

Add the Entity dropdown field inside the form, after the Agent Team field:

```tsx
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Entity (Subsidiary)
            </label>
            <select
              value={formData.entityId}
              onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Not assigned</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Determines which entity approver receives this staff member's tickets
            </p>
          </div>
```

Update `handleSubmit` — the `onSave(formData)` call already passes the full `formData` object, so `entityId` will be included automatically. Ensure `entityId` is sent as `null` when empty string:

In `handleSubmit`, before `await onSave(formData)`, add:
```tsx
      const payload = {
        ...formData,
        entityId: formData.entityId || null,
      };
      await onSave(payload);
```

And remove the direct `await onSave(formData)` line.

- [ ] **Step 2: Update UserAccountsTab to show Entity column and Approver badge**

Open `frontend/src/components/admin/UserAccountsTab.tsx`.

Add `entities` to props interface:
```tsx
    entities: { id: string; name: string; code: string }[];
    approverEntityMap: Record<string, string>; // userId → entity name
```

Add `entities` and `approverEntityMap` to the destructured props.

In the table header, after the `Department` `<th>`, add:
```tsx
                                <th className="px-8 py-5">Entity</th>
```

In the table body row, after the department `<td>`, add:
```tsx
                                    <td className="px-8 py-5 text-sm text-[#44546f]">
                                        {user.entityId
                                            ? entities.find(e => e.id === user.entityId)?.name || '—'
                                            : '—'}
                                        {approverEntityMap[user.id] && (
                                            <div className="mt-1">
                                                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-black uppercase rounded-full border border-violet-100">
                                                    Approver: {approverEntityMap[user.id]}
                                                </span>
                                            </div>
                                        )}
                                    </td>
```

Update `colSpan` on the empty-state row from `6` to `7`.

- [ ] **Step 3: Pass entities and approverEntityMap from AdminSettings.tsx**

Open `frontend/pages/AdminSettings.tsx`.

Build `approverEntityMap` from entities:
```tsx
    const approverEntityMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        entities.forEach((e) => {
            if (e.isActive) map[e.approverId] = e.name;
        });
        return map;
    }, [entities]);
```

Find where `<UserAccountsTab` is rendered and add the new props:
```tsx
                        entities={entities}
                        approverEntityMap={approverEntityMap}
```

Find where `<UserEditModal` is rendered and add:
```tsx
                        entities={entities}
```

Also ensure the `user` object passed to `UserEditModal` includes `entityId` — update the `onEditUser` handler to pass `entityId` from the user object.

- [ ] **Step 4: Ensure backend updateUser accepts entityId**

Open `backend/src/controllers/user.controller.ts`. Find the `updateUser` handler and locate where user fields are extracted from `req.body`. Add `entityId` to the destructure:

```typescript
        const { firstName, lastName, email, phone, department, jobTitle, isActive, managerId, agentTeam, executiveRole, entityId } = req.body;
```

And add it to the Prisma update data:
```typescript
            ...(entityId !== undefined && { entityId: entityId || null }),
```

Also ensure the `getUsers` / `listUsers` query includes `entityId` in the select/return so the frontend receives it. Find the `findMany` call for users and add `entityId: true` to the select fields.

- [ ] **Step 5: Verify frontend builds**

```bash
cd frontend
npm run build 2>&1 | tail -20
```

Expected: No TypeScript errors.

- [ ] **Step 6: Test in browser**

Log in as admin → Admin Console → User Accounts. Verify Entity column appears. Click Edit on a user — verify Entity dropdown populated with seeded entities. Select an entity, save, confirm Entity column updates.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/UserEditModal.tsx frontend/src/components/admin/UserAccountsTab.tsx frontend/pages/AdminSettings.tsx backend/src/controllers/user.controller.ts
git commit -m "feat: add entity assignment to user profiles and approver badge in user accounts table"
```

---

## Task 8: Ticket Detail — Entity Approvals Panel

**Files:**
- Modify: `frontend/pages/ArticleDetail.tsx` or wherever the ticket detail page lives (verify path)

- [ ] **Step 1: Locate the ticket detail page**

```bash
find /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend -name "RequestDetail*" -o -name "TicketDetail*" | head -10
grep -rn "requestApproval\|approvals\|RequestApproval" /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend/pages/ --include="*.tsx" -l
```

- [ ] **Step 2: Add EntityApprovalsPanel component**

Create `frontend/src/components/EntityApprovalsPanel.tsx`:

```tsx
import React from 'react';

interface EntityApproval {
    id: string;
    entityId: string | null;
    approverId: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comments: string | null;
    updatedAt: string;
    entity?: { id: string; name: string; code: string } | null;
    approver?: { id: string; firstName: string; lastName: string } | null;
}

interface EntityApprovalsPanelProps {
    approvals: EntityApproval[];
}

const STATUS_STYLES = {
    PENDING:  'bg-amber-50 text-amber-600 border-amber-100',
    APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    REJECTED: 'bg-red-50 text-red-600 border-red-100',
};

const STATUS_ICONS = {
    PENDING:  'pending',
    APPROVED: 'check_circle',
    REJECTED: 'cancel',
};

export const EntityApprovalsPanel: React.FC<EntityApprovalsPanelProps> = ({ approvals }) => {
    const entityApprovals = approvals.filter((a) => a.entityId !== null);
    if (entityApprovals.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-black text-[#101418] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc] text-lg">corporate_fare</span>
                Entity Approvals
            </h3>
            <div className="space-y-3">
                {entityApprovals.map((approval) => (
                    <div key={approval.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <div className="font-bold text-sm text-[#101418]">
                                {approval.entity?.name || 'Unknown Entity'}
                                <span className="ml-2 text-[10px] font-black text-gray-400 font-mono">{approval.entity?.code}</span>
                            </div>
                            <div className="text-xs text-[#44546f] mt-0.5">
                                Approver: {approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName}` : '—'}
                            </div>
                            {approval.comments && (
                                <div className="text-xs text-[#44546f] mt-1 italic">"{approval.comments}"</div>
                            )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[approval.status]}`}>
                            <span className="material-symbols-outlined text-[12px]">{STATUS_ICONS[approval.status]}</span>
                            {approval.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

- [ ] **Step 3: Include entity/approver data in the approvals API response**

Open `backend/src/controllers/request.controller.ts`. Find the `getRequestById` handler. In the `include` object for `approvals`, extend it to include entity and approver:

```typescript
            approvals: {
                include: {
                    approver: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    entity: {
                        select: { id: true, name: true, code: true },
                    },
                },
            },
```

- [ ] **Step 4: Render EntityApprovalsPanel in the ticket detail page**

In the ticket detail page component (found in Step 1), import the panel:

```tsx
import { EntityApprovalsPanel } from '../src/components/EntityApprovalsPanel';
```

In the JSX, render it where the approvals/sidebar section is (after the existing approval details):

```tsx
<EntityApprovalsPanel approvals={request.approvals || []} />
```

- [ ] **Step 5: Verify in browser**

Create a request of a type that has entity routing configured. Verify the Entity Approvals panel appears on the ticket detail page showing each entity card with Pending status.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/EntityApprovalsPanel.tsx backend/src/controllers/request.controller.ts
git commit -m "feat: add EntityApprovalsPanel to ticket detail and include entity data in approvals response"
```

---

## Task 9: Seed Test Entities

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add entity seed data**

Open `backend/prisma/seed.ts`. At an appropriate point after users are seeded (find the comment `// ── Users` or similar), add:

```typescript
  // ── Entities ─────────────────────────────────────────────────────────────
  console.log('Seeding entities...');

  // Fetch the admin user as a fallback approver
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
  const hrUser = await prisma.user.findUnique({ where: { email: 'hr@test.local' } });

  if (adminUser && hrUser) {
    await prisma.entity.upsert({
      where: { code: 'CIT-MY' },
      update: {},
      create: {
        name: 'Citadel Malaysia',
        code: 'CIT-MY',
        description: 'Citadel Malaysia Sdn Bhd',
        approverId: adminUser.id,
        isActive: true,
      },
    });

    await prisma.entity.upsert({
      where: { code: 'CIT-SG' },
      update: {},
      create: {
        name: 'Citadel Singapore',
        code: 'CIT-SG',
        description: 'Citadel Singapore Pte Ltd',
        approverId: hrUser.id,
        isActive: true,
      },
    });

    await prisma.entity.upsert({
      where: { code: 'CIT-HK' },
      update: {},
      create: {
        name: 'Citadel Hong Kong',
        code: 'CIT-HK',
        description: 'Citadel HK Limited',
        approverId: adminUser.id,
        isActive: true,
      },
    });
  }
```

- [ ] **Step 2: Run seed**

```bash
cd backend
npm run prisma:seed
```

Expected: Seed completes with "Seeding entities..." logged and no errors.

- [ ] **Step 3: Verify in Prisma Studio**

```bash
cd backend
npm run prisma:studio
```

Open the `entities` table and verify 3 rows.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: seed test entities for CIT-MY, CIT-SG, CIT-HK"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| `Entity` model with approver FK | Task 1 |
| `RequestTypeEntityRouting` with `routingMode` | Task 1 |
| `User.entityId` FK | Task 1 |
| `RequestApproval.entityId` FK | Task 1 |
| REQUESTER_ENTITY routing mode | Task 3 |
| CUSTOM_FIELD routing mode | Task 3 |
| Parallel approval record creation | Task 3 |
| Deduplication of entity codes | Task 3 |
| Inactive entity approver guard | Task 2 (createEntity/updateEntity validation) |
| Hook into request creation | Task 4 |
| Admin Entities tab | Task 6 |
| User profile entity dropdown | Task 7 |
| User table entity column + Approver badge | Task 7 |
| Ticket detail Entity Approvals panel | Task 8 |
| Seed test entities | Task 9 |

**Gap identified:** The spec mentions that when all entity approvals are `APPROVED`, the request advances to the next status. `allEntityApprovalsResolved()` is defined in Task 3 but not wired to the approval action handler in `approval.controller.ts`. Add this step:

- [ ] **Bonus Step: Wire allEntityApprovalsResolved into approval action**

Open `backend/src/controllers/approval.controller.ts`. Find the handler that processes an approver's approval/rejection action. After saving the approval status, add:

```typescript
import { allEntityApprovalsResolved } from '../services/entityRouting.service';

// After updating the approval record status...
if (approval.approverType === 'ENTITY') {
    const { allApproved, anyRejected } = await allEntityApprovalsResolved(approval.requestId);
    if (anyRejected) {
        await prisma.request.update({
            where: { id: approval.requestId },
            data: { status: 'REJECTED' },
        });
        // Notify requester of rejection
    } else if (allApproved) {
        await prisma.request.update({
            where: { id: approval.requestId },
            data: { status: 'RESOLVED' },
        });
        // Notify requester of full approval
    }
}
```

Then commit:
```bash
git add backend/src/controllers/approval.controller.ts backend/src/services/entityRouting.service.ts
git commit -m "feat: advance request status when all entity approvals resolve"
```

# Request Participants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow requesters and agents/admins to add participants to a ticket so those users get read-only view access and receive notifications when added and when ticket status changes.

**Architecture:** New `RequestParticipant` Prisma model (join table) links users to requests. Three new REST endpoints handle CRUD. Access control in `getRequestById` is extended to grant participants view access. Notifications fan out to participants on add and status change. Frontend adds a "Participants" section to `ActionSidebar` with inline typeahead.

**Tech Stack:** Node.js + Express + TypeScript + Prisma + PostgreSQL (backend); React 19 + TypeScript + Vite (frontend); existing `notify()` service for notifications.

---

## File Map

**Backend — create:**
- `backend/src/controllers/participant.controller.ts` — list/add/remove participant handlers
- `backend/src/routes/participant.routes.ts` — routes for `/requests/:id/participants`

**Backend — modify:**
- `backend/prisma/schema.prisma` — add `RequestParticipant` model + relations on `User` and `Request`
- `backend/src/controllers/request.controller.ts` — extend `getRequestById` access gate + `updateStatus` to notify participants
- `backend/src/routes/request.routes.ts` — mount participant routes under `/:id/participants`

**Frontend — create:**
- `frontend/src/components/request-detail/ParticipantsSection.tsx` — self-contained participants UI with typeahead

**Frontend — modify:**
- `frontend/src/services/request.service.ts` — add `getParticipants`, `addParticipant`, `removeParticipant`
- `frontend/src/components/request-detail/ActionSidebar.tsx` — render `<ParticipantsSection>` at the bottom

---

## Task 1: Prisma Schema — Add RequestParticipant Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model and relations**

Open `backend/prisma/schema.prisma`. At the end of the file (before any trailing comments), add:

```prisma
model RequestParticipant {
  id          String   @id @default(uuid()) @db.Uuid
  requestId   String   @map("request_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  addedById   String   @map("added_by_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  request   Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  user      User    @relation("RequestParticipants", fields: [userId], references: [id])
  addedBy   User    @relation("ParticipantAddedBy", fields: [addedById], references: [id])

  @@unique([requestId, userId])
  @@map("request_participants")
}
```

- [ ] **Step 2: Add back-relation to the `Request` model**

In the `Request` model (around line 510), inside the Relations section, add after `crmAccountLinks`:

```prisma
  participants        RequestParticipant[]
```

- [ ] **Step 3: Add back-relations to the `User` model**

In the `User` model, inside the Relations section (after `announcementReads`), add:

```prisma
  participatingIn     RequestParticipant[] @relation("RequestParticipants")
  participantsAdded   RequestParticipant[] @relation("ParticipantAddedBy")
```

- [ ] **Step 4: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_request_participants
```

Expected: Migration applied successfully, `request_participants` table created.

- [ ] **Step 5: Regenerate Prisma client**

```bash
npm run prisma:generate
```

Expected: Client regenerated, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add RequestParticipant model to schema"
```

---

## Task 2: Participant Controller

**Files:**
- Create: `backend/src/controllers/participant.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { hasRole } from '../middleware/auth.middleware';
import { notify } from '../services/notification.service';

class ParticipantController {
    /**
     * GET /api/v1/requests/:id/participants
     * Accessible by requester, agents, admins, and existing participants.
     */
    listParticipants = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        const isParticipant = !!(await prisma.requestParticipant.findUnique({
            where: { requestId_userId: { requestId, userId: req.user!.id } },
        }));

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT') &&
            !isParticipant
        ) {
            throw new AppError('Forbidden', 403);
        }

        const participants = await prisma.requestParticipant.findMany({
            where: { requestId },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
                addedBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json({ status: 'success', data: { participants } });
    });

    /**
     * POST /api/v1/requests/:id/participants
     * Body: { userId: string }
     * Allowed: requester, agents, admins.
     */
    addParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);
        const { userId } = req.body;

        if (!userId || typeof userId !== 'string') {
            throw new AppError('userId is required', 400);
        }

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true, referenceNumber: true, summary: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT')
        ) {
            throw new AppError('Only the requester or an agent/admin can add participants', 403);
        }

        // Cannot add the requester themselves as a participant
        if (userId === request.requesterId) {
            throw new AppError('The requester is already associated with this request', 400);
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (!targetUser) throw new AppError('User not found', 404);

        const participant = await prisma.requestParticipant.create({
            data: {
                requestId,
                userId,
                addedById: req.user!.id,
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
        });

        // Notify the new participant
        await notify({
            userId,
            eventType: 'PARTICIPANT_ADDED',
            variables: {
                referenceNumber: request.referenceNumber,
                summary: request.summary,
            },
            relatedRequestId: requestId,
        });

        res.status(201).json({ status: 'success', data: { participant } });
    });

    /**
     * DELETE /api/v1/requests/:id/participants/:userId
     * Allowed: requester, agents, admins.
     */
    removeParticipant = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
        const requestId = String(req.params.id);
        const targetUserId = String(req.params.userId);

        const request = await prisma.request.findUnique({
            where: { id: requestId },
            select: { id: true, requesterId: true },
        });
        if (!request) throw new AppError('Request not found', 404);

        if (
            request.requesterId !== req.user!.id &&
            !hasRole(req, 'ADMIN', 'AGENT')
        ) {
            throw new AppError('Only the requester or an agent/admin can remove participants', 403);
        }

        await prisma.requestParticipant.delete({
            where: { requestId_userId: { requestId, userId: targetUserId } },
        }).catch(() => {
            throw new AppError('Participant not found', 404);
        });

        res.json({ status: 'success', data: null });
    });
}

export const participantController = new ParticipantController();
```

- [ ] **Step 2: Compile-check**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/participant.controller.ts
git commit -m "feat: add participant controller (list/add/remove)"
```

---

## Task 3: Participant Routes + Mount

**Files:**
- Create: `backend/src/routes/participant.routes.ts`
- Modify: `backend/src/routes/request.routes.ts`

- [ ] **Step 1: Create participant routes file**

```typescript
import { Router } from 'express';
import { participantController } from '../controllers/participant.controller';

const router = Router({ mergeParams: true }); // mergeParams gives access to :id from parent

router.get('/', participantController.listParticipants);
router.post('/', participantController.addParticipant);
router.delete('/:userId', participantController.removeParticipant);

export default router;
```

- [ ] **Step 2: Mount in request.routes.ts**

Open `backend/src/routes/request.routes.ts`. Add at the top with existing imports:

```typescript
import participantRoutes from './participant.routes';
```

Then at the bottom of the file, after all existing routes:

```typescript
router.use('/:id/participants', participantRoutes);
```

- [ ] **Step 3: Compile-check**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/participant.routes.ts backend/src/routes/request.routes.ts
git commit -m "feat: add participant routes under /requests/:id/participants"
```

---

## Task 4: Notification Template for PARTICIPANT_ADDED

The notification system requires a DB record in `NotificationTemplate` for each event type. Add the seed/migration for `PARTICIPANT_ADDED`.

**Files:**
- Modify: `backend/prisma/seed.ts` (or wherever notification templates are seeded)

- [ ] **Step 1: Find how templates are seeded**

```bash
grep -n "PARTICIPANT\|STATUS_CHANGED\|REQUEST_ASSIGNED" backend/prisma/seed.ts | head -10
```

If templates are in `seed.ts`, find the notification template upsert block and add:

```typescript
await prisma.notificationTemplate.upsert({
    where: { eventType: 'PARTICIPANT_ADDED' },
    create: {
        eventType: 'PARTICIPANT_ADDED',
        name: 'Added as Request Participant',
        subject: 'You have been added to request {{referenceNumber}}',
        bodyTemplate: 'You have been added as a participant to request <strong>{{referenceNumber}}</strong>: {{summary}}. You can now view this request and will receive status updates.',
        pushTitle: 'Added to Request',
        isActive: true,
    },
    update: {},
});
```

- [ ] **Step 2: Alternatively, insert directly via Prisma script**

If the templates are not in seed.ts but inserted elsewhere, run:

```bash
cd backend && node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.notificationTemplate.upsert({
  where: { eventType: 'PARTICIPANT_ADDED' },
  create: {
    eventType: 'PARTICIPANT_ADDED',
    name: 'Added as Request Participant',
    subject: 'You have been added to request {{referenceNumber}}',
    bodyTemplate: 'You have been added as a participant to request <strong>{{referenceNumber}}</strong>: {{summary}}. You can now view this request and will receive status updates.',
    pushTitle: 'Added to Request',
    isActive: true,
  },
  update: {},
}).then(r => { console.log('Created:', r.eventType); p.\$disconnect(); });
"
```

Expected: `Created: PARTICIPANT_ADDED`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts  # if modified
git commit -m "feat: add PARTICIPANT_ADDED notification template"
```

---

## Task 5: Extend Access Control — getRequestById

Participants should be able to view the ticket. Extend the access gate in `request.controller.ts`.

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Include participants in getRequestById query**

In `getRequestById`, find the `prisma.request.findUnique` call (around line 1165). It already has an `include` block. Add `participants` to the include:

```typescript
participants: {
    select: { userId: true },
},
```

- [ ] **Step 2: Add isParticipant check**

Just before the access control check (around line 1286), add:

```typescript
const isParticipant = (request as any).participants?.some((p: any) => p.userId === req.user!.id) ?? false;
```

- [ ] **Step 3: Add isParticipant to the access gate**

Update the existing `if (request.requesterId !== req.user!.id && !hasRole(...))` block (around line 1306) to:

```typescript
if (
    request.requesterId !== req.user!.id &&
    !hasRole(req, 'ADMIN', 'AGENT') &&
    !isCEOApprover &&
    !isCTOApprover &&
    !isCFOApprover &&
    !isGroupDceoApprover &&
    !isParticipant
) {
    throw new AppError('You do not have permission to view this request', 403);
}
```

- [ ] **Step 4: Compile-check**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: grant participants view access to request detail"
```

---

## Task 6: Notify Participants on Status Change

**Files:**
- Modify: `backend/src/controllers/request.controller.ts`

- [ ] **Step 1: Find the status change notification in updateStatus**

Locate the `updateStatus` method (around line 1748). Find this block (around line 1826):

```typescript
// Notify requester of status change
await notify({
    userId: request.requesterId,
    eventType: 'STATUS_CHANGED',
    variables: {
        referenceNumber: request.referenceNumber,
        newStatus: status,
    },
    relatedRequestId: request.id,
});
```

- [ ] **Step 2: Load participants and fan-out notification**

Replace the above block with:

```typescript
// Notify requester of status change
await notify({
    userId: request.requesterId,
    eventType: 'STATUS_CHANGED',
    variables: {
        referenceNumber: request.referenceNumber,
        newStatus: status,
    },
    relatedRequestId: request.id,
});

// Notify participants of status change
const participantRecords = await prisma.requestParticipant.findMany({
    where: { requestId: id },
    select: { userId: true },
});
await Promise.all(
    participantRecords.map((p) =>
        notify({
            userId: p.userId,
            eventType: 'STATUS_CHANGED',
            variables: {
                referenceNumber: request.referenceNumber,
                newStatus: status,
            },
            relatedRequestId: request.id,
        })
    )
);
```

Note: The `request` variable at this point in `updateStatus` is the updated request returned by `prisma.request.update`. Verify it has `referenceNumber` and `requesterId` selected in the update return. If not, add them to the `select`/`include` of the update call.

- [ ] **Step 3: Compile-check**

```bash
cd backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/request.controller.ts
git commit -m "feat: notify participants on request status change"
```

---

## Task 7: Frontend Service Methods

**Files:**
- Modify: `frontend/src/services/request.service.ts`

- [ ] **Step 1: Add participant types and service methods**

Open `frontend/src/services/request.service.ts`. After the existing imports and interfaces, add:

```typescript
export interface RequestParticipant {
    id: string;
    userId: string;
    requestId: string;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string | null;
    };
    addedBy: {
        id: string;
        firstName: string;
        lastName: string;
    };
}
```

Then inside the `requestService` object, after the last existing method, add:

```typescript
async getParticipants(requestId: string): Promise<RequestParticipant[]> {
    const response = await apiClient.get(`/requests/${requestId}/participants`);
    return response.data.data.participants;
},

async addParticipant(requestId: string, userId: string): Promise<RequestParticipant> {
    const response = await apiClient.post(`/requests/${requestId}/participants`, { userId });
    return response.data.data.participant;
},

async removeParticipant(requestId: string, userId: string): Promise<void> {
    await apiClient.delete(`/requests/${requestId}/participants/${userId}`);
},
```

- [ ] **Step 2: Compile-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/request.service.ts
git commit -m "feat: add participant API methods to request service"
```

---

## Task 8: ParticipantsSection Component

**Files:**
- Create: `frontend/src/components/request-detail/ParticipantsSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { requestService, RequestParticipant } from '../../services/request.service';
import apiClient from '../../services/api';

interface UserSearchResult {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
}

interface ParticipantsSectionProps {
    requestId: string;
    canEdit: boolean; // true for requester, agent, admin
}

export default function ParticipantsSection({ requestId, canEdit }: ParticipantsSectionProps) {
    const [participants, setParticipants] = useState<RequestParticipant[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        requestService.getParticipants(requestId).then(setParticipants).catch(() => {});
    }, [requestId]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearch(false);
                setQuery('');
                setResults([]);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!val.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/users?search=${encodeURIComponent(val)}&limit=8`);
                const users: UserSearchResult[] = res.data.data?.users ?? res.data.data ?? [];
                // Filter out already-added participants
                const participantIds = new Set(participants.map((p) => p.userId));
                setResults(users.filter((u) => !participantIds.has(u.id)));
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    }

    async function handleAdd(user: UserSearchResult) {
        setAddingId(user.id);
        try {
            const participant = await requestService.addParticipant(requestId, user.id);
            setParticipants((prev) => [...prev, participant]);
            setQuery('');
            setResults([]);
            setShowSearch(false);
        } catch {
            // silently ignore — could show a toast here
        } finally {
            setAddingId(null);
        }
    }

    async function handleRemove(userId: string) {
        setRemovingId(userId);
        try {
            await requestService.removeParticipant(requestId, userId);
            setParticipants((prev) => prev.filter((p) => p.userId !== userId));
        } catch {
            // silently ignore
        } finally {
            setRemovingId(null);
        }
    }

    function initials(p: RequestParticipant) {
        return `${p.user.firstName[0] ?? ''}${p.user.lastName[0] ?? ''}`.toUpperCase();
    }

    return (
        <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Participants {participants.length > 0 && `(${participants.length})`}
                </span>
                {canEdit && (
                    <button
                        onClick={() => setShowSearch((s) => !s)}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        + Add
                    </button>
                )}
            </div>

            {/* Participant chips */}
            <div className="flex flex-wrap gap-2 mb-2">
                {participants.map((p) => (
                    <div
                        key={p.userId}
                        title={`${p.user.firstName} ${p.user.lastName} (${p.user.email})`}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
                    >
                        {p.user.avatarUrl ? (
                            <img src={p.user.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                            <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">
                                {initials(p)}
                            </span>
                        )}
                        <span>{p.user.firstName} {p.user.lastName}</span>
                        {canEdit && (
                            <button
                                onClick={() => handleRemove(p.userId)}
                                disabled={removingId === p.userId}
                                className="ml-1 text-blue-400 hover:text-red-500 leading-none"
                                aria-label={`Remove ${p.user.firstName}`}
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
                {participants.length === 0 && (
                    <span className="text-xs text-gray-400">No participants yet</span>
                )}
            </div>

            {/* Inline typeahead search */}
            {canEdit && showSearch && (
                <div ref={searchRef} className="relative">
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Search name or email..."
                        className="w-full text-xs border border-blue-400 rounded-md px-2 py-1.5 outline-none"
                    />
                    {(results.length > 0 || loading) && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-md shadow-lg z-20 max-h-48 overflow-y-auto">
                            {loading && (
                                <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
                            )}
                            {results.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => handleAdd(u)}
                                    disabled={addingId === u.id}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-xs"
                                >
                                    <span className="w-6 h-6 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                        {`${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()}
                                    </span>
                                    <span>
                                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                                        <span className="text-gray-400 ml-1">{u.email}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Compile-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/request-detail/ParticipantsSection.tsx
git commit -m "feat: add ParticipantsSection component with inline typeahead"
```

---

## Task 9: Wire ParticipantsSection into ActionSidebar

**Files:**
- Modify: `frontend/src/components/request-detail/ActionSidebar.tsx`

- [ ] **Step 1: Import ParticipantsSection**

At the top of `ActionSidebar.tsx`, after the existing imports, add:

```typescript
import ParticipantsSection from './ParticipantsSection';
```

- [ ] **Step 2: Determine canEdit prop**

Inside the `ActionSidebar` component body, derive `canEdit`. Find where `userRoles` is used and add:

```typescript
const canEdit =
    userId === requesterId ||
    userRoles.includes('ADMIN') ||
    userRoles.includes('AGENT');
```

- [ ] **Step 3: Render ParticipantsSection**

At the end of the returned JSX (just before the closing `</div>` of the sidebar), add:

```tsx
<ParticipantsSection
    requestId={requestId}
    canEdit={canEdit}
/>
```

- [ ] **Step 4: Compile-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/request-detail/ActionSidebar.tsx
git commit -m "feat: render ParticipantsSection in ActionSidebar"
```

---

## Task 10: Manual End-to-End Verification

- [x] **Step 1: Start backend and frontend dev servers**
- [x] **Step 2: Log in as requester and open HR-9**
- [x] **Step 3: Add a participant**
- [x] **Step 4: Log in as the added participant**
- [x] **Step 5: Verify the participant cannot see the + Add button or × remove buttons**
- [x] **Step 6: Remove participant as requester**
- [x] **Step 7: Verify participant loses access after removal**
- [x] **Step 8: Check notifications**
- [x] **Step 9: Final commit**

# Announcement Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company-wide announcement board where management (HR, Finance, C-suite) can publish memos and announcements, visible to all staff on the dashboard and a dedicated board page.

**Architecture:** Backend is fully scaffolded (routes, controller, service, validator, route registration) — only the `parse-doc` endpoint and `attachmentUrl` field are missing. Frontend needs a service update, two new pages (`Announcements.tsx`, `AnnouncementsManage.tsx`), a dashboard widget, and App.tsx wiring.

**Tech Stack:** Node.js + Express + Prisma + PostgreSQL (backend); React 19 + TypeScript + Vite (frontend); `pdf-parse` for PDF text extraction; `mammoth` for DOCX text extraction; multer memory storage for parse-doc; AWS S3 (`s3Service.uploadBuffer`) for file storage.

---

## File Map

### Modified
- `backend/prisma/schema.prisma` — add `FINANCE`, `POLICY` to `AnnouncementCategory` enum; add `attachmentUrl` field to `Announcement` model
- `backend/src/routes/announcement.routes.ts` — add `POST /parse-doc` route
- `backend/src/controllers/announcement.controller.ts` — add `parseDoc` handler; update `create`/`update` to pass `attachmentUrl`
- `backend/src/services/announcement.service.ts` — add `attachmentUrl` to `createAnnouncement` and `updateAnnouncement` signatures
- `backend/src/validators/announcement.validator.ts` — add `FINANCE`, `POLICY` to category enum; add `attachmentUrl` field
- `frontend/src/services/announcement.service.ts` — add `attachmentUrl` to types; add `parseDocument()`, `publish()`, `togglePin()` methods; fix `adminGetOne` to use `GET /announcements/:id`; update `update` to use `PATCH`
- `frontend/pages/Dashboard.tsx` — add announcement widget below Recent Requests
- `frontend/App.tsx` — add routes + nav links for Announcements and Manage Announcements

### Created
- `frontend/pages/Announcements.tsx` — staff announcement board
- `frontend/pages/AnnouncementsManage.tsx` — admin management page

---

## Task 1: DB Migration — Add FINANCE/POLICY categories and attachmentUrl

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Update schema.prisma**

  In `schema.prisma`, change the `AnnouncementCategory` enum (around line 1841):

  ```prisma
  enum AnnouncementCategory {
    HR
    MARKETING
    IT
    GENERAL
    FINANCE
    POLICY
  }
  ```

  In the `Announcement` model (around line 1855), add `attachmentUrl` after `authorId`:

  ```prisma
  attachmentUrl   String?               @map("attachment_url") @db.VarChar(1000)
  ```

- [ ] **Step 2: Run migration**

  ```bash
  cd backend
  npx prisma migrate dev --name add_announcement_finance_policy_attachment
  ```

  Expected: Migration created and applied. Prisma client regenerated automatically.

- [ ] **Step 3: Verify migration applied**

  ```bash
  npx prisma studio
  ```

  Open the `Announcement` table — confirm `attachmentUrl` column exists and category enum includes `FINANCE` and `POLICY`.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/
  git commit -m "feat(db): add FINANCE/POLICY announcement categories and attachmentUrl field"
  ```

---

## Task 2: Backend — Install PDF/DOCX parsing libraries

**Files:**
- Modify: `backend/package.json` (via npm install)

- [ ] **Step 1: Install libraries**

  ```bash
  cd backend
  npm install pdf-parse mammoth
  npm install --save-dev @types/pdf-parse @types/mammoth
  ```

  Expected: Both packages appear in `package.json` dependencies.

- [ ] **Step 2: Verify types compile**

  ```bash
  npm run build 2>&1 | head -20
  ```

  Expected: Build succeeds or errors are unrelated to the new packages.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/package.json backend/package-lock.json
  git commit -m "chore(backend): install pdf-parse and mammoth for document parsing"
  ```

---

## Task 3: Backend — Update validator for new categories and attachmentUrl

**Files:**
- Modify: `backend/src/validators/announcement.validator.ts`

- [ ] **Step 1: Update the validator**

  Replace the full content of `backend/src/validators/announcement.validator.ts`:

  ```typescript
  import { z } from 'zod';

  const announcementCategoryEnum = z.enum(['HR', 'MARKETING', 'IT', 'GENERAL', 'FINANCE', 'POLICY']);
  const announcementPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

  export const createAnnouncementSchema = z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').max(500),
      content: z.string().min(1, 'Content is required'),
      excerpt: z.string().optional(),
      category: announcementCategoryEnum.default('GENERAL'),
      priority: announcementPriorityEnum.default('MEDIUM'),
      targetAudience: z.string().max(50).default('ALL'),
      isPinned: z.boolean().default(false),
      isPublished: z.boolean().default(false),
      expiresAt: z.string().datetime().optional().nullable(),
      attachmentUrl: z.string().max(1000).optional().nullable(),
    }),
  });

  export const updateAnnouncementSchema = z.object({
    body: z.object({
      title: z.string().min(1).max(500).optional(),
      content: z.string().min(1).optional(),
      excerpt: z.string().optional().nullable(),
      category: announcementCategoryEnum.optional(),
      priority: announcementPriorityEnum.optional(),
      targetAudience: z.string().max(50).optional(),
      isPinned: z.boolean().optional(),
      isPublished: z.boolean().optional(),
      expiresAt: z.string().datetime().optional().nullable(),
      attachmentUrl: z.string().max(1000).optional().nullable(),
    }),
  });

  export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>['body'];
  export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>['body'];
  ```

- [ ] **Step 2: Verify build**

  ```bash
  cd backend && npm run build 2>&1 | grep -E "error|warning" | head -10
  ```

  Expected: No TypeScript errors related to the validator.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/validators/announcement.validator.ts
  git commit -m "feat(announcement): add FINANCE/POLICY categories and attachmentUrl to validator"
  ```

---

## Task 4: Backend — Add attachmentUrl to service create/update

**Files:**
- Modify: `backend/src/services/announcement.service.ts`

- [ ] **Step 1: Update createAnnouncement signature and data**

  In `announcement.service.ts`, in the `createAnnouncement` method, add `attachmentUrl` to the data parameter type and to the `prisma.announcement.create` call:

  Change the data parameter type from:
  ```typescript
  async createAnnouncement(data: {
    title: string;
    content: string;
    excerpt?: string;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    authorId: string;
  })
  ```
  To:
  ```typescript
  async createAnnouncement(data: {
    title: string;
    content: string;
    excerpt?: string;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
    authorId: string;
  })
  ```

  In the `prisma.announcement.create` data block, add after `expiresAt`:
  ```typescript
  attachmentUrl: data.attachmentUrl || null,
  ```

- [ ] **Step 2: Update updateAnnouncement signature**

  In the `updateAnnouncement` method, add `attachmentUrl` to the data parameter type:
  ```typescript
  async updateAnnouncement(id: string, data: {
    title?: string;
    content?: string;
    excerpt?: string | null;
    category?: string;
    priority?: string;
    targetAudience?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    expiresAt?: string | null;
    attachmentUrl?: string | null;
  })
  ```

  The `updateData` spread already handles this since `attachmentUrl` will be spread into `updateData`.

- [ ] **Step 3: Verify build**

  ```bash
  cd backend && npm run build 2>&1 | grep -E "error" | head -10
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/services/announcement.service.ts
  git commit -m "feat(announcement): add attachmentUrl to create/update service methods"
  ```

---

## Task 5: Backend — Add parse-doc endpoint

**Files:**
- Modify: `backend/src/controllers/announcement.controller.ts`
- Modify: `backend/src/routes/announcement.routes.ts`

- [ ] **Step 1: Add parseDoc handler to controller**

  At the top of `announcement.controller.ts`, add the new imports after the existing imports:

  ```typescript
  import multer from 'multer';
  import * as crypto from 'crypto';
  import * as path from 'path';
  import { s3Service } from '../services/s3.service';
  import { config } from '../config';
  ```

  Add a memory-storage multer instance at class level (outside the class, after imports):

  ```typescript
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('Only PDF and DOCX files are supported'));
      }
      cb(null, true);
    },
  });

  export const uploadDocMiddleware = memoryUpload.single('file');
  ```

  Add the `parseDoc` handler inside the `AnnouncementController` class (before the closing brace):

  ```typescript
  parseDoc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file as Express.Multer.File & { buffer: Buffer };
    if (!file) throw new AppError('No file provided', 400);

    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    try {
      if (file.mimetype === 'application/pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(file.buffer);
        text = result.text?.trim() ?? '';
      } else {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value?.trim() ?? '';
      }
    } catch {
      text = '';
    }

    // Upload original file to S3
    const key = `cwc/announcements/${crypto.randomUUID()}${ext}`;
    await s3Service.uploadBuffer(key, file.buffer, file.mimetype);

    const warning = text.length < 50 ? 'Could not extract readable text from document' : null;

    res.json({
      status: 'success',
      data: {
        text: text.length >= 50 ? text : '',
        filename: file.originalname,
        s3Key: key,
        warning,
      },
    });
  });
  ```

- [ ] **Step 2: Register parse-doc route**

  In `announcement.routes.ts`, add the import at the top:

  ```typescript
  import { announcementController, uploadDocMiddleware } from '../controllers/announcement.controller';
  ```

  Add the route BEFORE the `router.use(requirePermission('announcement:write'))` line (it already requires the authenticate middleware from `router.use(authenticate)` at the top):

  ```typescript
  /**
   * POST /announcements/parse-doc
   * Upload a PDF or DOCX, extract text, store file in S3
   * Requires: announcement:write
   */
  router.post(
    '/parse-doc',
    requirePermission('announcement:write'),
    uploadDocMiddleware,
    announcementController.parseDoc,
  );
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd backend && npm run build 2>&1 | grep -E "error" | head -20
  ```

  Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/controllers/announcement.controller.ts backend/src/routes/announcement.routes.ts
  git commit -m "feat(announcement): add parse-doc endpoint for PDF/DOCX text extraction"
  ```

---

## Task 6: Backend — Update controller create/update to pass attachmentUrl

**Files:**
- Modify: `backend/src/controllers/announcement.controller.ts`

- [ ] **Step 1: Update create handler**

  In the `create` handler, destructure `attachmentUrl` from `req.body`:

  ```typescript
  const { title, content, excerpt, category, priority, targetAudience, isPinned, isPublished, expiresAt, attachmentUrl } = req.body;
  ```

  Pass it to the service:

  ```typescript
  const announcement = await announcementService.createAnnouncement({
    title,
    content,
    excerpt,
    category,
    priority,
    targetAudience,
    isPinned,
    isPublished,
    expiresAt,
    attachmentUrl,
    authorId: req.user!.id,
  });
  ```

- [ ] **Step 2: Update update handler**

  In the `update` handler, destructure `attachmentUrl`:

  ```typescript
  const { title, content, excerpt, category, priority, targetAudience, isPinned, isPublished, expiresAt, attachmentUrl } = req.body;
  ```

  Pass it to the service:

  ```typescript
  const announcement = await announcementService.updateAnnouncement(id, {
    title,
    content,
    excerpt,
    category,
    priority,
    targetAudience,
    isPinned,
    isPublished,
    expiresAt,
    attachmentUrl,
  });
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd backend && npm run build 2>&1 | grep -E "error" | head -10
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/controllers/announcement.controller.ts
  git commit -m "feat(announcement): pass attachmentUrl through create/update controller handlers"
  ```

---

## Task 7: Frontend — Update announcement service

**Files:**
- Modify: `frontend/src/services/announcement.service.ts`

- [ ] **Step 1: Replace the full file content**

  ```typescript
  import api from './api';

  export type AnnouncementCategory = 'HR' | 'MARKETING' | 'IT' | 'GENERAL' | 'FINANCE' | 'POLICY';
  export type AnnouncementPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  export interface Announcement {
    id: string;
    title: string;
    content: string;
    excerpt: string | null;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    targetAudience: string | null;
    isPinned: boolean;
    isPublished: boolean;
    publishedAt: string | null;
    expiresAt: string | null;
    attachmentUrl: string | null;
    authorId: string;
    createdAt: string;
    updatedAt: string;
    author?: { id: string; firstName: string; lastName: string; email?: string };
    isRead?: boolean;
  }

  export interface DashboardAnnouncement {
    id: string;
    title: string;
    excerpt: string | null;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    isPinned: boolean;
    publishedAt: string | null;
    author?: { firstName: string; lastName: string };
    isRead?: boolean;
  }

  export interface DashboardData {
    pinned: DashboardAnnouncement[];
    latest: DashboardAnnouncement[];
  }

  export interface PaginatedAnnouncements {
    announcements: Announcement[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }

  export interface ParseDocResult {
    text: string;
    filename: string;
    s3Key: string;
    warning: string | null;
  }

  const announcementService = {
    async getDashboard(): Promise<DashboardData> {
      const res = await api.get('/announcements/dashboard');
      return res.data?.data ?? res.data;
    },

    async getUnreadCount(): Promise<number> {
      const res = await api.get('/announcements/unread-count');
      return res.data?.data?.count ?? 0;
    },

    async list(params?: {
      page?: number;
      limit?: number;
      category?: AnnouncementCategory;
      priority?: AnnouncementPriority;
      search?: string;
    }): Promise<PaginatedAnnouncements> {
      const res = await api.get('/announcements', { params });
      return res.data?.data ?? res.data;
    },

    async getOne(id: string): Promise<Announcement> {
      const res = await api.get(`/announcements/${id}`);
      return res.data?.data?.announcement ?? res.data?.data ?? res.data;
    },

    async markRead(id: string): Promise<void> {
      await api.post(`/announcements/${id}/read`);
    },

    async markAllRead(): Promise<void> {
      await api.post('/announcements/mark-all-read');
    },

    async adminList(params?: {
      page?: number;
      limit?: number;
      category?: AnnouncementCategory;
      priority?: AnnouncementPriority;
      isPublished?: boolean;
      search?: string;
    }): Promise<PaginatedAnnouncements> {
      const res = await api.get('/announcements/admin/all', { params });
      return res.data?.data ?? res.data;
    },

    async create(data: {
      title: string;
      content: string;
      excerpt?: string;
      category: AnnouncementCategory;
      priority: AnnouncementPriority;
      targetAudience?: string;
      isPinned?: boolean;
      isPublished?: boolean;
      expiresAt?: string | null;
      attachmentUrl?: string | null;
    }): Promise<Announcement> {
      const res = await api.post('/announcements', data);
      return res.data?.data?.announcement ?? res.data?.data ?? res.data;
    },

    async update(id: string, data: {
      title?: string;
      content?: string;
      excerpt?: string | null;
      category?: AnnouncementCategory;
      priority?: AnnouncementPriority;
      targetAudience?: string;
      isPinned?: boolean;
      isPublished?: boolean;
      expiresAt?: string | null;
      attachmentUrl?: string | null;
    }): Promise<Announcement> {
      const res = await api.patch(`/announcements/${id}`, data);
      return res.data?.data?.announcement ?? res.data?.data ?? res.data;
    },

    async publish(id: string): Promise<Announcement> {
      const res = await api.patch(`/announcements/${id}/publish`);
      return res.data?.data?.announcement ?? res.data?.data ?? res.data;
    },

    async togglePin(id: string, isPinned: boolean): Promise<Announcement> {
      const res = await api.patch(`/announcements/${id}/pin`, { isPinned });
      return res.data?.data?.announcement ?? res.data?.data ?? res.data;
    },

    async remove(id: string): Promise<void> {
      await api.delete(`/announcements/${id}`);
    },

    async parseDocument(file: File): Promise<ParseDocResult> {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/announcements/parse-doc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data ?? res.data;
    },
  };

  export default announcementService;
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep "announcement.service" | head -10
  ```

  Expected: No errors for this file.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/services/announcement.service.ts
  git commit -m "feat(announcement): update frontend service with full type coverage and new methods"
  ```

---

## Task 8: Frontend — Dashboard announcement widget

**Files:**
- Modify: `frontend/pages/Dashboard.tsx`

- [ ] **Step 1: Add import and state**

  At the top of `Dashboard.tsx`, add:

  ```typescript
  import announcementService, { DashboardAnnouncement } from '../src/services/announcement.service';
  ```

  Inside the `Dashboard` component, add state after the existing state declarations:

  ```typescript
  const [pinned, setPinned] = useState<DashboardAnnouncement[]>([]);
  const [latestAnnouncements, setLatestAnnouncements] = useState<DashboardAnnouncement[]>([]);
  ```

- [ ] **Step 2: Fetch announcements in useEffect**

  Inside the existing `fetchData` function (alongside the `Promise.all`), add the announcement fetch — update the `Promise.all` call:

  ```typescript
  const [desksData, requestsData, dashboardData] = await Promise.all([
    serviceDeskService.getAllServiceDesks(),
    requestService.getAllRequests({ limit: 50, requesterId: user?.id }),
    announcementService.getDashboard().catch(() => ({ pinned: [], latest: [] })),
  ]);
  setServiceDesks(desksData);
  const requests: Request[] = requestsData.requests || [];
  setAllRequests(requests);
  setPinned(dashboardData.pinned ?? []);
  setLatestAnnouncements(dashboardData.latest ?? []);
  ```

- [ ] **Step 3: Add category color helper**

  Add this helper function near the top of the file (after `formatRelativeTime`):

  ```typescript
  const CATEGORY_COLOR: Record<string, string> = {
    HR: 'var(--color-hr-500)',
    IT: 'var(--color-it-500)',
    FINANCE: 'var(--color-fin-500)',
    POLICY: '#8b5cf6',
    MARKETING: '#f59e0b',
    GENERAL: 'var(--color-brand-700)',
  };

  const PRIORITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    CRITICAL: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
    HIGH:     { bg: '#fff7ed', color: '#ea580c', label: 'High' },
    MEDIUM:   { bg: '#eff6ff', color: '#2563eb', label: 'Medium' },
    LOW:      { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
  };
  ```

- [ ] **Step 4: Add widget JSX below Recent Requests section**

  After the closing `</div>` of the Recent Requests section (after line ~380), add:

  ```tsx
  {/* ── ANNOUNCEMENTS WIDGET ── */}
  {(pinned.length > 0 || latestAnnouncements.length > 0) && (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Announcements
        </h2>
        <Link to="/announcements" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-brand-700)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {[...pinned.slice(0, 3), ...latestAnnouncements.slice(0, 3)].map((a, idx) => {
          const isPin = pinned.includes(a);
          const catColor = CATEGORY_COLOR[a.category] || 'var(--color-brand-700)';
          const pri = PRIORITY_BADGE[a.priority];
          return (
            <Link
              key={a.id}
              to={`/announcements?open=${a.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-5)',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                  background: isPin ? '#fffbeb' : 'transparent',
                  borderLeft: !a.isRead ? `3px solid var(--color-brand-700)` : '3px solid transparent',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-subtle)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isPin ? '#fffbeb' : 'transparent'; }}
              >
                {isPin && (
                  <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
                )}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: a.isRead ? 500 : 700,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {a.title}
                  </div>
                  {a.excerpt && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.excerpt}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {pri && (
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: pri.bg, color: pri.color }}>
                      {pri.label}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {a.publishedAt ? formatRelativeTime(a.publishedAt) : ''}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  )}
  ```

- [ ] **Step 5: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep "Dashboard" | head -10
  ```

  Expected: No errors.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/pages/Dashboard.tsx
  git commit -m "feat(dashboard): add announcement widget below recent requests"
  ```

---

## Task 9: Frontend — Staff announcement board page

**Files:**
- Create: `frontend/pages/Announcements.tsx`

- [ ] **Step 1: Create the page**

  Create `frontend/pages/Announcements.tsx`:

  ```tsx
  import React, { useState, useEffect, useCallback } from 'react';
  import { useSearchParams } from 'react-router-dom';
  import announcementService, { Announcement, AnnouncementCategory, AnnouncementPriority } from '../src/services/announcement.service';
  import { useToast } from '../src/context/ToastContext';

  const CATEGORY_COLOR: Record<string, string> = {
    HR: 'var(--color-hr-500)',
    IT: 'var(--color-it-500)',
    FINANCE: 'var(--color-fin-500)',
    POLICY: '#8b5cf6',
    MARKETING: '#f59e0b',
    GENERAL: 'var(--color-brand-700)',
  };

  const PRIORITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    CRITICAL: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
    HIGH:     { bg: '#fff7ed', color: '#ea580c', label: 'High' },
    MEDIUM:   { bg: '#eff6ff', color: '#2563eb', label: 'Medium' },
    LOW:      { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  const CATEGORIES: { value: string; label: string }[] = [
    { value: '', label: 'All Categories' },
    { value: 'HR', label: 'HR' },
    { value: 'IT', label: 'IT' },
    { value: 'FINANCE', label: 'Finance' },
    { value: 'POLICY', label: 'Policy' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'GENERAL', label: 'General' },
  ];

  export default function Announcements() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { showToast } = useToast();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<AnnouncementCategory | ''>('');
    const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('open'));
    const [selected, setSelected] = useState<Announcement | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchAnnouncements = useCallback(async () => {
      setLoading(true);
      try {
        const result = await announcementService.list({
          page,
          limit: 20,
          category: category as AnnouncementCategory || undefined,
        });
        setAnnouncements(result.announcements);
        setTotalPages(result.pagination.totalPages);
      } catch {
        showToast('Failed to load announcements', 'error');
      } finally {
        setLoading(false);
      }
    }, [page, category]);

    useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

    useEffect(() => {
      if (!selectedId) { setSelected(null); return; }
      setModalLoading(true);
      announcementService.getOne(selectedId)
        .then(a => setSelected(a))
        .catch(() => showToast('Failed to load announcement', 'error'))
        .finally(() => setModalLoading(false));
    }, [selectedId]);

    const pinned = announcements.filter(a => a.isPinned);
    const rest = announcements.filter(a => !a.isPinned);

    const AnnouncementCard = ({ a }: { a: Announcement }) => {
      const catColor = CATEGORY_COLOR[a.category] || 'var(--color-brand-700)';
      const pri = PRIORITY_BADGE[a.priority];
      return (
        <div
          onClick={() => { setSelectedId(a.id); setSearchParams({ open: a.id }); }}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: `4px solid ${catColor}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'var(--shadow-md)'; el.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = ''; el.style.transform = ''; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
            {a.isPinned && <span style={{ fontSize: 12 }}>📌</span>}
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: '.05em' }}>{a.category}</span>
            {pri && (
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: pri.bg, color: pri.color }}>{pri.label}</span>
            )}
            {!a.isRead && (
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}>New</span>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: a.isRead ? 600 : 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            {a.title}
          </div>
          {a.excerpt && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
              {a.excerpt}
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {a.author && <span>{a.author.firstName} {a.author.lastName}</span>}
            {a.publishedAt && <span>{formatDate(a.publishedAt)}</span>}
          </div>
        </div>
      );
    };

    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>Announcements</h1>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value as AnnouncementCategory | ''); setPage(1); }}
            style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ height: 12, width: '30%', background: 'var(--color-border)', borderRadius: 4 }} />
                <div style={{ height: 18, width: '70%', background: 'var(--color-border)', borderRadius: 4 }} />
                <div style={{ height: 12, width: '50%', background: 'var(--color-border)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', opacity: .3, marginBottom: 'var(--space-3)' }}>campaign</span>
            <p style={{ fontWeight: 700 }}>No announcements at this time</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 'var(--space-3)' }}>📌 Pinned</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {pinned.map(a => <AnnouncementCard key={a.id} a={a} />)}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {rest.map(a => <AnnouncementCard key={a.id} a={a} />)}
              </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? .4 : 1, fontFamily: 'var(--font-sans)' }}>← Prev</button>
                <span style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? .4 : 1, fontFamily: 'var(--font-sans)' }}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {selectedId && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}
            onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setSearchParams({}); } }}
          >
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', maxWidth: 680, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow-xl)' }}>
              {modalLoading || !selected ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
              ) : (
                <div style={{ padding: 'var(--space-8)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: CATEGORY_COLOR[selected.category] || 'var(--color-brand-700)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{selected.category}</span>
                        {PRIORITY_BADGE[selected.priority] && (
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--radius-full)', background: PRIORITY_BADGE[selected.priority].bg, color: PRIORITY_BADGE[selected.priority].color }}>{PRIORITY_BADGE[selected.priority].label}</span>
                        )}
                      </div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>{selected.title}</h2>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                        {selected.author && `${selected.author.firstName} ${selected.author.lastName}`}
                        {selected.publishedAt && ` · ${formatDate(selected.publishedAt)}`}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedId(null); setSearchParams({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 'var(--space-6)' }}>
                    {selected.content}
                  </div>
                  {selected.attachmentUrl && (
                    <a
                      href={`/api/v1/files/download/${selected.attachmentUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'none' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                      Download original document
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep "Announcements.tsx" | head -10
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/pages/Announcements.tsx
  git commit -m "feat(announcement): add staff announcement board page"
  ```

---

## Task 10: Frontend — Admin management page

**Files:**
- Create: `frontend/pages/AnnouncementsManage.tsx`

- [ ] **Step 1: Create the page**

  Create `frontend/pages/AnnouncementsManage.tsx`:

  ```tsx
  import React, { useState, useEffect, useCallback, useRef } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useAuth } from '../src/context/AuthContext';
  import { hasPermission } from '../src/utils/permissions';
  import announcementService, { Announcement, AnnouncementCategory, AnnouncementPriority } from '../src/services/announcement.service';
  import { useToast } from '../src/context/ToastContext';

  const CATEGORIES: AnnouncementCategory[] = ['HR', 'IT', 'FINANCE', 'POLICY', 'MARKETING', 'GENERAL'];
  const PRIORITIES: AnnouncementPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  const EMPTY_FORM = {
    title: '',
    content: '',
    excerpt: '',
    category: 'GENERAL' as AnnouncementCategory,
    priority: 'MEDIUM' as AnnouncementPriority,
    isPinned: false,
    isPublished: false,
    expiresAt: '',
    attachmentUrl: null as string | null,
    attachmentName: '',
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  export default function AnnouncementsManage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [slideOverOpen, setSlideOverOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Permission guard
    useEffect(() => {
      if (user && !hasPermission(user, 'announcement:write')) {
        showToast('You do not have permission to manage announcements', 'error');
        navigate('/');
      }
    }, [user]);

    const fetchAll = useCallback(async () => {
      setLoading(true);
      try {
        const result = await announcementService.adminList({
          limit: 50,
          isPublished: filterStatus === 'all' ? undefined : filterStatus === 'published',
        });
        setAnnouncements(result.announcements);
      } catch {
        showToast('Failed to load announcements', 'error');
      } finally {
        setLoading(false);
      }
    }, [filterStatus]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    function openNew() {
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      setSlideOverOpen(true);
    }

    function openEdit(a: Announcement) {
      setEditingId(a.id);
      setForm({
        title: a.title,
        content: a.content,
        excerpt: a.excerpt ?? '',
        category: a.category,
        priority: a.priority,
        isPinned: a.isPinned,
        isPublished: a.isPublished,
        expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : '',
        attachmentUrl: a.attachmentUrl,
        attachmentName: a.attachmentUrl ? 'Existing attachment' : '',
      });
      setSlideOverOpen(true);
    }

    async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingDoc(true);
      try {
        const result = await announcementService.parseDocument(file);
        setForm(f => ({
          ...f,
          content: result.text || f.content,
          attachmentUrl: result.s3Key,
          attachmentName: result.filename,
        }));
        if (result.warning) showToast(result.warning, 'warning');
        else showToast('Document uploaded and text extracted', 'success');
      } catch {
        showToast('Failed to upload document', 'error');
      } finally {
        setUploadingDoc(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }

    async function handleSave(publishNow: boolean) {
      if (!form.title.trim() || !form.content.trim()) {
        showToast('Title and content are required', 'error');
        return;
      }
      setSaving(true);
      try {
        const data = {
          title: form.title.trim(),
          content: form.content.trim(),
          excerpt: form.excerpt.trim() || undefined,
          category: form.category,
          priority: form.priority,
          isPinned: form.isPinned,
          isPublished: publishNow,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          attachmentUrl: form.attachmentUrl,
        };
        if (editingId) {
          await announcementService.update(editingId, data);
        } else {
          await announcementService.create(data);
        }
        showToast(publishNow ? 'Announcement published' : 'Draft saved', 'success');
        setSlideOverOpen(false);
        fetchAll();
      } catch {
        showToast('Failed to save announcement', 'error');
      } finally {
        setSaving(false);
      }
    }

    async function handlePublish(id: string) {
      try {
        await announcementService.publish(id);
        showToast('Published', 'success');
        fetchAll();
      } catch {
        showToast('Failed to publish', 'error');
      }
    }

    async function handleDelete(id: string) {
      try {
        await announcementService.remove(id);
        showToast('Deleted', 'success');
        setDeleteConfirmId(null);
        fetchAll();
      } catch {
        showToast('Failed to delete', 'error');
      }
    }

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: 'var(--space-2) var(--space-3)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-sm)',
      background: 'var(--color-surface)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box',
    };

    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Manage Announcements</h1>
          <button
            onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-5)', background: 'var(--color-brand-700)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            New Announcement
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          {(['all', 'draft', 'published'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: 'var(--space-1) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', background: filterStatus === s ? 'var(--color-brand-700)' : 'var(--color-surface)', color: filterStatus === s ? '#fff' : 'var(--color-text-primary)' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
          ) : announcements.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', opacity: .3, marginBottom: 'var(--space-3)' }}>campaign</span>
              <p style={{ fontWeight: 700 }}>No announcements yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                    {['Title', 'Category', 'Priority', 'Status', 'Pinned', 'Expiry', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {announcements.map(a => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{a.category}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{a.priority}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: a.isPublished ? '#f0fdf4' : '#f8fafc', color: a.isPublished ? '#16a34a' : '#64748b' }}>
                          {a.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center', fontSize: 14 }}>{a.isPinned ? '📌' : '—'}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{a.expiresAt ? formatDate(a.expiresAt) : '—'}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button onClick={() => openEdit(a)} style={{ padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Edit</button>
                          {!a.isPublished && (
                            <button onClick={() => handlePublish(a.id)} style={{ padding: '4px 10px', border: '1px solid #16a34a', borderRadius: 'var(--radius-md)', background: '#f0fdf4', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#16a34a', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Publish</button>
                          )}
                          <button onClick={() => setDeleteConfirmId(a.id)} style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', background: '#fef2f2', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide-over */}
        {slideOverOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSlideOverOpen(false)} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 560, background: 'var(--color-surface)', height: '100%', overflow: 'auto', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                <button onClick={() => setSlideOverOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>✕</button>
              </div>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" />
              </div>

              {/* Category + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Category</label>
                  <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AnnouncementCategory }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Priority</label>
                  <select style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as AnnouncementPriority }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Excerpt (optional preview text)</label>
                <input style={inputStyle} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown in dashboard widget" />
              </div>

              {/* Document Upload */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Upload Document (PDF or DOCX)</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleDocUpload} style={{ display: 'none' }} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    style={{ padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-muted)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: uploadingDoc ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: uploadingDoc ? .6 : 1 }}
                  >
                    {uploadingDoc ? 'Uploading...' : 'Choose file'}
                  </button>
                  {form.attachmentName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                      {form.attachmentName}
                      <button onClick={() => setForm(f => ({ ...f, attachmentUrl: null, attachmentName: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 14, lineHeight: 1 }}>✕</button>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>Text will be extracted into the body below. Original file stored as attachment.</p>
              </div>

              {/* Body */}
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Body *</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Announcement content..."
                />
              </div>

              {/* Options row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Expiry Date</label>
                  <input type="date" style={inputStyle} value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} style={{ width: 16, height: 16 }} />
                    📌 Pin to top
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  style={{ flex: 1, padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  style={{ flex: 1, padding: 'var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand-700)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving ? .6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm modal */}
        {deleteConfirmId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-xl)' }}>
              <h3 style={{ fontWeight: 800, marginBottom: 'var(--space-2)' }}>Delete Announcement</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)' }}>This will permanently remove the announcement. This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button onClick={() => setDeleteConfirmId(null)} style={{ flex: 1, padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={() => handleDelete(deleteConfirmId)} style={{ flex: 1, padding: 'var(--space-3)', border: 'none', borderRadius: 'var(--radius-md)', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep "AnnouncementsManage" | head -10
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/pages/AnnouncementsManage.tsx
  git commit -m "feat(announcement): add admin management page with slide-over form and doc upload"
  ```

---

## Task 11: Frontend — Wire routes and nav in App.tsx

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Add imports**

  In `App.tsx`, add after the last existing page import:

  ```tsx
  import Announcements from './pages/Announcements';
  import AnnouncementsManage from './pages/AnnouncementsManage';
  ```

- [ ] **Step 2: Add nav links**

  In the nav links array (where `{ to: '/approvals', ... }` and other nav items are defined, around line 108), add:

  ```tsx
  { to: '/announcements', label: 'Announcements', show: true },
  { to: '/announcements/manage', label: 'Manage Announcements', show: hasPermission(user, 'announcement:write') },
  ```

- [ ] **Step 3: Add routes**

  In the `<Routes>` block alongside the existing route definitions, add:

  ```tsx
  <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
  <Route path="/announcements/manage" element={<ProtectedRoute requirePermission="announcement:write"><AnnouncementsManage /></ProtectedRoute>} />
  ```

- [ ] **Step 4: Verify TypeScript**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
  ```

  Expected: No errors.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/App.tsx
  git commit -m "feat(announcement): add routes and nav links for announcements and admin page"
  ```

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Start backend**

  ```bash
  cd backend && npm run dev
  ```

  Expected: Server starts on port 3000, no startup errors.

- [ ] **Step 2: Start frontend**

  ```bash
  cd frontend && npm run dev
  ```

  Expected: Vite server starts on port 5173.

- [ ] **Step 3: Log in as admin and test management page**

  1. Open `http://localhost:5173` and log in as `admin@test.local` / `abc@123`
  2. Navigate to "Manage Announcements" in the nav
  3. Click "New Announcement" — slide-over should open
  4. Fill in title: "Test Announcement", select category HR, priority HIGH
  5. Click "Publish" — should save and appear in the table with status Published

- [ ] **Step 4: Test staff board**

  1. Navigate to `/announcements` — the published announcement should appear
  2. Click on the card — detail modal opens with full content
  3. Close the modal

- [ ] **Step 5: Test dashboard widget**

  1. Navigate to `/` (Dashboard)
  2. Scroll below Recent Requests — the Announcements widget should show the announcement

- [ ] **Step 6: Test document upload**

  1. Go back to Manage Announcements, create a new announcement
  2. Click "Choose file" and upload a PDF or DOCX
  3. Verify: extracted text appears in the body field, attachment name shown
  4. Publish — verify "Download original document" button appears in the detail modal

- [ ] **Step 7: Commit (if any fixes were made)**

  ```bash
  git add -A && git commit -m "fix: announcement smoke test fixes"
  ```

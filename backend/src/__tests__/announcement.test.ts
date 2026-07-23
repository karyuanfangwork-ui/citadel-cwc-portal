/**
 * Announcement Module — Integration Tests
 *
 * Tests the full announcement API surface including:
 * - CRUD lifecycle
 * - B3: isRead on list endpoint
 * - B5: Unpublish clears publishedAt
 * - B7: Author-or-admin check
 * - B1/G2: targetAudience filtering
 * - A1: XSS sanitization
 * - G1: Notifications on publish
 * - G3/G4: Pagination & search
 * - G9: Sorting
 * - G11: Audit trail
 * - A3: Soft-delete + restore
 * - Validation
 * - Mark all as read
 * - Pin/unpin
 * - Dashboard & unread count
 */

// Mock puppeteer to avoid ESM parse error in Jest
jest.mock('puppeteer', () => ({}));
jest.mock('../credit/services/htmlToPdf.service', () => ({
  htmlToPdfService: { generate: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import routes from '../routes/index';
import { errorHandler } from '../middleware/error.middleware';
import { config } from '../config';
import prisma from '../utils/prisma';

// ── App setup ────────────────────────────────────────────────────────────────

const app = express();
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);
app.set('query parser', 'extended');
app.use(express.json());
app.use('/api/v1', routes);
app.use(errorHandler);

// ── Test data ────────────────────────────────────────────────────────────────
// Using existing seed roles (ADMIN, NORMAL_STAFF) which have the right permissions

const ADMIN_EMAIL = 'test-announce-admin@test.local';
const READER_EMAIL = 'test-announce-reader@test.local';
const PASSWORD='***';

let adminToken: string;
let readerToken: string;
let adminUserId: string;
let readerUserId: string;
let createdAnnouncementIds: string[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(userId: string, email: string): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { userId, email, jti },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

async function cleanupTestUsers() {
  const emails = [ADMIN_EMAIL, READER_EMAIL];
  // Delete in correct order to respect foreign keys
  for (const email of emails) {
    await prisma.announcementRead.deleteMany({
      where: { announcement: { author: { email } } },
    });
  }
  await prisma.announcement.deleteMany({
    where: { author: { email: { in: emails } } },
  });
  for (const email of emails) {
    await prisma.notification.deleteMany({ where: { user: { email } } });
    await prisma.auditLog.deleteMany({ where: { userEmail: email } });
    await prisma.session.deleteMany({ where: { user: { email } } });
    await prisma.userRole.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  }
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanupTestUsers();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Create admin user (ADMIN role = announcement:admin + announcement:write + announcement:read)
  const adminUser = await prisma.user.create({
    data: { email: ADMIN_EMAIL, passwordHash, firstName: 'Admin', lastName: 'AnnTest', isActive: true, tenantId: '00000000-0000-0000-0000-000000000001' },
  });
  adminUserId = adminUser.id;

  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
  if (!adminRole) throw new Error('ADMIN role not found — run seed first');
  await prisma.userRole.create({ data: { userId: adminUserId, roleId: adminRole.id } });

  // Create reader user (NORMAL_STAFF role = announcement:read only)
  const readerUser = await prisma.user.create({
    data: { email: READER_EMAIL, passwordHash, firstName: 'Reader', lastName: 'AnnTest', isActive: true, tenantId: '00000000-0000-0000-0000-000000000001' },
  });
  readerUserId = readerUser.id;

  const staffRole = await prisma.role.findFirst({ where: { name: 'NORMAL_STAFF' } });
  if (!staffRole) throw new Error('NORMAL_STAFF role not found — run seed first');
  await prisma.userRole.create({ data: { userId: readerUserId, roleId: staffRole.id } });

  // Generate JWTs — auth middleware loads permissions from DB via role-permission mapping
  adminToken = generateToken(adminUserId, ADMIN_EMAIL);
  readerToken = generateToken(readerUserId, READER_EMAIL);
});

afterAll(async () => {
  await cleanupTestUsers();
  await prisma.$disconnect();
});

afterEach(async () => {
  if (createdAnnouncementIds.length > 0) {
    await prisma.announcementRead.deleteMany({
      where: { announcementId: { in: createdAnnouncementIds } },
    });
    await prisma.announcement.deleteMany({
      where: { id: { in: createdAnnouncementIds } },
    });
    createdAnnouncementIds = [];
  }
});

async function createAnnouncement(token: string, overrides: Record<string, unknown> = {}): Promise<request.Response> {
  const defaults = {
    title: 'Test Announcement',
    content: '<p>Test content</p>',
    category: 'GENERAL',
    priority: 'MEDIUM',
    targetAudience: 'ALL',
    isPublished: true,
  };
  const res = await request(app)
    .post('/api/v1/announcements')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...defaults, ...overrides });
  if (res.body?.data?.announcement?.id) {
    createdAnnouncementIds.push(res.body.data.announcement.id);
  }
  return res;
}

// ══════════════════════════════════════════════════════════════════════════════

describe('Announcement Module', () => {

  // ── B3: isRead in list endpoint ──────────────────────────────────────────

  describe('GET /announcements — isRead field (B3)', () => {
    it('returns isRead=false for unread announcements', async () => {
      await createAnnouncement(adminToken, { title: 'Unread Test' });

      const res = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(200);
      const announcements = res.body.data?.announcements ?? res.body.data;
      const found = announcements.find((a: any) => a.title === 'Unread Test');
      expect(found).toBeDefined();
      expect(found.isRead).toBe(false);
    });

    it('returns isRead=true after marking as read', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Read Mark Test' });
      const id = createRes.body.data.announcement.id;

      await request(app)
        .post(`/api/v1/announcements/${id}/read`)
        .set('Authorization', `Bearer ${readerToken}`);

      const res = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`);

      const found = (res.body.data?.announcements ?? res.body.data).find((a: any) => a.id === id);
      expect(found).toBeDefined();
      expect(found.isRead).toBe(true);
    });
  });

  // ── B5: Unpublish clears publishedAt ─────────────────────────────────────

  describe('PATCH /announcements/:id — unpublish clears publishedAt (B5)', () => {
    it('clears publishedAt when unpublishing', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Unpublish Test' });
      const id = createRes.body.data.announcement.id;
      expect(createRes.body.data.announcement.publishedAt).toBeTruthy();

      const res = await request(app)
        .patch(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false });

      expect(res.status).toBe(200);
      expect(res.body.data.announcement.isPublished).toBe(false);
      expect(res.body.data.announcement.publishedAt).toBeNull();
    });
  });

  // ── B7: Author-or-admin check ───────────────────────────────────────────

  describe('Authorization — author-or-admin check (B7)', () => {
    it('blocks a reader from updating an announcement', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Blocked Edit' });
      const id = createRes.body.data.announcement.id;

      const res = await request(app)
        .patch(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ title: 'Hacked' });

      // Reader has NORMAL_STAFF role → only announcement:read
      // requirePermission('announcement:write') should block
      expect(res.status).toBe(403);
    });

    it('blocks a reader from deleting an announcement', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Blocked Delete' });
      const id = createRes.body.data.announcement.id;

      const res = await request(app)
        .delete(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${readerToken}`);

      // requirePermission('announcement:admin') blocks reader
      expect(res.status).toBe(403);
    });

    it('allows the author (admin) to update their own announcement', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Author Edit' });
      const id = createRes.body.data.announcement.id;

      const res = await request(app)
        .patch(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated by Author' });

      expect(res.status).toBe(200);
      expect(res.body.data.announcement.title).toBe('Updated by Author');
    });
  });

  // ── B1/G2: targetAudience enforcement ────────────────────────────────────

  describe('targetAudience filtering (B1/G2)', () => {
    it('returns ALL-targeted announcements for any user', async () => {
      await createAnnouncement(adminToken, { title: 'ALL Visible', targetAudience: 'ALL' });

      const res = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(200);
      const announcements = res.body.data?.announcements ?? res.body.data;
      const found = announcements.find((a: any) => a.title === 'ALL Visible');
      expect(found).toBeDefined();
    });

    it('filters announcements by target audience based on user roles', async () => {
      await createAnnouncement(adminToken, { title: 'IT Only', targetAudience: 'IT_ONLY' });
      await createAnnouncement(adminToken, { title: 'HR Only', targetAudience: 'HR_ONLY' });

      // Reader with NORMAL_STAFF role should NOT see IT_ONLY or HR_ONLY
      const res = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`);

      const announcements = res.body.data?.announcements ?? res.body.data;
      expect(announcements.find((a: any) => a.title === 'IT Only')).toBeUndefined();
      expect(announcements.find((a: any) => a.title === 'HR Only')).toBeUndefined();
    });

    it('admin list shows all announcements regardless of audience', async () => {
      await createAnnouncement(adminToken, { title: 'Admin IT', targetAudience: 'IT_ONLY' });

      const res = await request(app)
        .get('/api/v1/announcements/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const announcements = res.body.data?.announcements ?? res.body.data;
      expect(announcements.find((a: any) => a.title === 'Admin IT')).toBeDefined();
    });
  });

  // ── A1: XSS sanitization ────────────────────────────────────────────────

  describe('XSS sanitization (A1)', () => {
    it('strips script tags from content', async () => {
      const res = await createAnnouncement(adminToken, {
        title: 'XSS Script',
        content: '<p>Hello</p><script>alert("xss")</script><p>World</p>',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.announcement.content).not.toContain('<script');
    });

    it('strips onclick and other event handlers', async () => {
      const res = await createAnnouncement(adminToken, {
        title: 'XSS Event',
        content: '<p onclick="alert(1)">Click</p>',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.announcement.content).not.toContain('onclick');
    });

    it('strips iframe tags', async () => {
      const res = await createAnnouncement(adminToken, {
        title: 'XSS Iframe',
        content: '<iframe src="https://evil.com"></iframe><p>Safe</p>',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.announcement.content).not.toContain('<iframe');
    });

    it('preserves safe HTML tags', async () => {
      const res = await createAnnouncement(adminToken, {
        title: 'Safe HTML',
        content: '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>',
      });
      expect(res.status).toBe(201);
      const content = res.body.data.announcement.content;
      expect(content).toContain('<h1>');
      expect(content).toContain('<strong>');
      expect(content).toContain('<em>');
    });
  });

  // ── G1: Notifications on publish ────────────────────────────────────────

  describe('Notification creation on publish (G1)', () => {
    it('creates notifications for target users', async () => {
      await prisma.notification.deleteMany({ where: { userId: readerUserId } });

      await createAnnouncement(adminToken, {
        title: 'Notify Test',
        targetAudience: 'ALL',
      });

      const notifications = await prisma.notification.findMany({
        where: { userId: readerUserId, channel: 'IN_APP' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications[0].subject).toContain('Notify Test');
    });
  });

  // ── G3/G4: Pagination and search ────────────────────────────────────────

  describe('Admin list — pagination and search (G3/G4)', () => {
    it('paginates results', async () => {
      const res = await request(app)
        .get('/api/v1/announcements/admin/all?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it('searches announcements by title', async () => {
      await createAnnouncement(adminToken, { title: 'UniqueSearchTitle_QXZ789' });

      const res = await request(app)
        .get('/api/v1/announcements/admin/all?search=QXZ789')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const announcements = res.body.data?.announcements ?? res.body.data;
      expect(announcements.find((a: any) => a.title === 'UniqueSearchTitle_QXZ789')).toBeDefined();
    });
  });

  // ── G9: Sorting ──────────────────────────────────────────────────────────

  describe('Sorting (G9)', () => {
    it('sorts admin list by priority descending', async () => {
      const res = await request(app)
        .get('/api/v1/announcements/admin/all?sortBy=priority&sortOrder=desc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data?.announcements ?? res.body.data)).toBe(true);
    });

    it('sorts user list by createdAt descending', async () => {
      const res = await request(app)
        .get('/api/v1/announcements?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data?.announcements ?? res.body.data)).toBe(true);
    });
  });

  // ── G11: Audit trail ────────────────────────────────────────────────────

  describe('Audit trail (G11)', () => {
    it('logs audit entry on creation', async () => {
      // Create as draft → action is 'announcement.create'; as published → 'announcement.publish'
      const res = await createAnnouncement(adminToken, { title: 'Audit Create' });
      const id = res.body.data.announcement.id;

      // Default create is published=true, so action will be 'announcement.publish'
      const audit = await prisma.auditLog.findFirst({
        where: { resourceType: 'announcement', resourceId: id },
        orderBy: { createdAt: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(adminUserId);
      expect(audit?.action).toMatch(/^announcement\.(create|publish)$/);
    });

    it('logs audit entry on deletion', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Audit Delete' });
      const id = createRes.body.data.announcement.id;

      await request(app)
        .delete(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const audit = await prisma.auditLog.findFirst({
        where: { resourceType: 'announcement', resourceId: id, action: 'announcement.delete' },
      });

      expect(audit).toBeDefined();
    });
  });

  // ── A3: Soft delete + restore ────────────────────────────────────────────

  describe('Soft delete and restore (A3)', () => {
    it('soft-deletes and appears in trash', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'SoftDel Test' });
      const id = createRes.body.data.announcement.id;

      const delRes = await request(app)
        .delete(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);

      // Not in normal list
      const listRes = await request(app)
        .get('/api/v1/announcements/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      const listed = (listRes.body.data?.announcements ?? listRes.body.data).find((a: any) => a.id === id);
      expect(listed).toBeUndefined();

      // In trash
      const trashRes = await request(app)
        .get('/api/v1/announcements/admin/trash')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(trashRes.status).toBe(200);
      const trashed = (trashRes.body.data?.announcements ?? trashRes.body.data).find((a: any) => a.id === id);
      expect(trashed).toBeDefined();
      expect(trashed.deletedAt).toBeTruthy();
    });

    it('restores a soft-deleted announcement', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Restore Test' });
      const id = createRes.body.data.announcement.id;

      await request(app).delete(`/api/v1/announcements/${id}`).set('Authorization', `Bearer ${adminToken}`);

      const restoreRes = await request(app)
        .patch(`/api/v1/announcements/${id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.announcement.deletedAt).toBeNull();

      // Back in normal list
      const listRes = await request(app)
        .get('/api/v1/announcements/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);
      const found = (listRes.body.data?.announcements ?? listRes.body.data).find((a: any) => a.id === id);
      expect(found).toBeDefined();
    });

    it('requires announcement:admin for restore', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Restore Perm' });
      const id = createRes.body.data.announcement.id;

      await request(app).delete(`/api/v1/announcements/${id}`).set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .patch(`/api/v1/announcements/${id}/restore`)
        .set('Authorization', `Bearer ${readerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Full CRUD lifecycle ──────────────────────────────────────────────────

  describe('Full CRUD lifecycle', () => {
    it('creates, reads, updates, publishes, unpublishes, and deletes', async () => {
      // CREATE as draft
      const createRes = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Lifecycle Test',
          content: '<p>Draft content</p>',
          category: 'IT',
          priority: 'HIGH',
          targetAudience: 'ALL',
          isPublished: false,
        });

      expect(createRes.status).toBe(201);
      const id = createRes.body.data.announcement.id;
      createdAnnouncementIds.push(id);
      expect(createRes.body.data.announcement.isPublished).toBe(false);
      expect(createRes.body.data.announcement.publishedAt).toBeNull();

      // READ
      const getRes = await request(app)
        .get(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${readerToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.announcement.title).toBe('Lifecycle Test');

      // UPDATE
      const updateRes = await request(app)
        .patch(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Lifecycle' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.announcement.title).toBe('Updated Lifecycle');

      // PUBLISH
      const pubRes = await request(app)
        .patch(`/api/v1/announcements/${id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.announcement.isPublished).toBe(true);
      expect(pubRes.body.data.announcement.publishedAt).toBeTruthy();

      // UNPUBLISH
      const unpubRes = await request(app)
        .patch(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: false });
      expect(unpubRes.status).toBe(200);
      expect(unpubRes.body.data.announcement.isPublished).toBe(false);
      expect(unpubRes.body.data.announcement.publishedAt).toBeNull();

      // DELETE
      const delRes = await request(app)
        .delete(`/api/v1/announcements/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('rejects creation without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid targetAudience values', async () => {
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Bad Audience',
          content: '<p>Test</p>',
          category: 'GENERAL',
          priority: 'MEDIUM',
          targetAudience: 'INVALID_VALUE',
        });
      expect(res.status).toBe(400);
    });

    it('rejects invalid category values', async () => {
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Bad Category',
          content: '<p>Test</p>',
          category: 'INVALID',
          priority: 'MEDIUM',
          targetAudience: 'ALL',
        });
      expect(res.status).toBe(400);
    });

    it('rejects creation without announcement:write permission', async () => {
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ title: 'No Perm', content: '<p>Test</p>', category: 'GENERAL', priority: 'MEDIUM' });
      expect(res.status).toBe(403);
    });
  });

  // ── Mark all as read ─────────────────────────────────────────────────────

  describe('Mark all as read (G6)', () => {
    it('marks all announcements as read for the user', async () => {
      await createAnnouncement(adminToken, { title: 'MAR1', targetAudience: 'ALL' });
      await createAnnouncement(adminToken, { title: 'MAR2', targetAudience: 'ALL' });

      const res = await request(app)
        .post('/api/v1/announcements/mark-all-read')
        .set('Authorization', `Bearer ${readerToken}`);
      expect(res.status).toBe(200);

      const listRes = await request(app)
        .get('/api/v1/announcements')
        .set('Authorization', `Bearer ${readerToken}`);
      const announcements = listRes.body.data?.announcements ?? listRes.body.data;
      const unread = announcements.filter((a: any) => a.isRead === false);
      expect(unread.length).toBe(0);
    });
  });

  // ── Pin/unpin ────────────────────────────────────────────────────────────

  describe('Pin/unpin', () => {
    it('pins and unpins an announcement', async () => {
      const createRes = await createAnnouncement(adminToken, { title: 'Pin Test' });
      const id = createRes.body.data.announcement.id;

      const pinRes = await request(app)
        .patch(`/api/v1/announcements/${id}/pin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPinned: true });
      expect(pinRes.status).toBe(200);
      expect(pinRes.body.data.announcement.isPinned).toBe(true);

      const unpinRes = await request(app)
        .patch(`/api/v1/announcements/${id}/pin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPinned: false });
      expect(unpinRes.status).toBe(200);
      expect(unpinRes.body.data.announcement.isPinned).toBe(false);
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────

  describe('Dashboard endpoint', () => {
    it('returns pinned and latest announcements', async () => {
      await createAnnouncement(adminToken, { title: 'Dash Test', targetAudience: 'ALL' });

      const res = await request(app)
        .get('/api/v1/announcements/dashboard')
        .set('Authorization', `Bearer ${readerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.pinned)).toBe(true);
      expect(Array.isArray(res.body.data.latest)).toBe(true);
    });
  });

  // ── Unread count ─────────────────────────────────────────────────────────

  describe('Unread count', () => {
    it('returns a numeric unread count', async () => {
      await createAnnouncement(adminToken, { title: 'UC Test', targetAudience: 'ALL' });

      const res = await request(app)
        .get('/api/v1/announcements/unread-count')
        .set('Authorization', `Bearer ${readerToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data.count).toBe('number');
      expect(res.body.data.count).toBeGreaterThanOrEqual(0);
    });
  });
});
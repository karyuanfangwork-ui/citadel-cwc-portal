/**
 * Sprint 4 — Webhook subscription routes
 *
 * CRUD for webhook subscriptions + delivery log viewing.
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { webhookService } from '../services/webhook.service';

const router = Router();

export const createWebhookSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    url: z.string().url().max(2048),
    secret: z.string().min(16).max(512).optional().nullable(),
    events: z.array(z.string().min(1).max(100)).min(1),
    maxRetries: z.number().int().min(0).max(10).optional(),
    retryDelaySec: z.number().int().positive().max(86400).optional(),
  }),
});

router.use(authenticate);

// List active subscriptions
router.get('/', requirePermission('credit:admin'), async (_req, res, next) => {
  try {
    const subs = await webhookService.listSubscriptions();
    res.json({ status: 'success', data: { subscriptions: subs } });
  } catch (e) { next(e); }
});

// Create subscription
router.post('/', requirePermission('credit:admin'), validate(createWebhookSchema), async (req, res, next) => {
  try {
    const { name, url, secret, events, maxRetries, retryDelaySec } = req.body;
    if (!name || !url || !Array.isArray(events)) {
      return res.status(400).json({ status: 'error', message: 'name, url, and events[] are required' });
    }
    const sub = await webhookService.createSubscription({ name, url, secret, events, maxRetries, retryDelaySec });
    res.json({ status: 'success', data: { subscription: sub } });
  } catch (e) { next(e); }
});

// Deactivate subscription
router.delete('/:id', requirePermission('credit:admin'), async (req, res, next) => {
  try {
    await webhookService.deleteSubscription(String(req.params.id));
    res.json({ status: 'success', data: { deleted: true } });
  } catch (e) { next(e); }
});

// List deliveries (optionally filtered by subscription)
router.get('/deliveries', requirePermission('credit:admin'), async (req, res, next) => {
  try {
    const subscriptionId = req.query.subscriptionId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const deliveries = await webhookService.listDeliveries(subscriptionId, limit);
    res.json({ status: 'success', data: { deliveries } });
  } catch (e) { next(e); }
});

export default router;
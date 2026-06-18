/**
 * Sprint 4 — Webhook subscription routes
 *
 * CRUD for webhook subscriptions + delivery log viewing.
 */
import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { webhookService } from '../services/webhook.service';

const router = Router();

router.use(authenticate);

// List active subscriptions
router.get('/', requirePermission('credit:admin'), async (_req, res, next) => {
  try {
    const subs = await webhookService.listSubscriptions();
    res.json({ status: 'success', data: { subscriptions: subs } });
  } catch (e) { next(e); }
});

// Create subscription
router.post('/', requirePermission('credit:admin'), async (req, res, next) => {
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
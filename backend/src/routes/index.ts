import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import requestRoutes from './request.routes';
import serviceDeskRoutes from './serviceDesk.routes';
import notificationRoutes from './notification.routes';
import kbRoutes from './kb.routes';
import searchRoutes from './search.routes';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/requests', requestRoutes);
router.use('/service-desks', serviceDeskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/kb', kbRoutes);
router.use('/search', searchRoutes);

export default router;

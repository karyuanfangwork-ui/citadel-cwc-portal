import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/search
 * @desc    Global search across requests, KB articles, etc.
 * @access  Private
 */
router.get('/', searchController.globalSearch);

/**
 * @route   GET /api/v1/search/requests
 * @desc    Search requests
 * @access  Private
 */
router.get('/requests', searchController.searchRequests);

/**
 * @route   GET /api/v1/search/articles
 * @desc    Search KB articles
 * @access  Private
 */
router.get('/articles', searchController.searchArticles);

/**
 * @route   GET /api/v1/search/users
 * @desc    Search users (Admin/Agent only)
 * @access  Private
 */
router.get('/users', searchController.searchUsers);

export default router;

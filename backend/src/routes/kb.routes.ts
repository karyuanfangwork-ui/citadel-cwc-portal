import { Router } from 'express';
import { kbController } from '../controllers/kb.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/kb/articles
 * @desc    Get all published articles
 * @access  Public
 */
router.get('/articles', optionalAuth, kbController.getAllArticles);

/**
 * @route   GET /api/v1/kb/articles/:slug
 * @desc    Get article by slug
 * @access  Public
 */
router.get('/articles/:slug', optionalAuth, kbController.getArticleBySlug);

/**
 * @route   POST /api/v1/kb/articles/:id/helpful
 * @desc    Mark article as helpful/not helpful
 * @access  Public
 */
router.post('/articles/:id/helpful', kbController.markHelpful);

// Admin/Agent routes
router.use(authenticate, authorize('ADMIN', 'AGENT'));

/**
 * @route   POST /api/v1/kb/articles
 * @desc    Create new article
 * @access  Private (Admin/Agent only)
 */
router.post('/articles', kbController.createArticle);

/**
 * @route   PUT /api/v1/kb/articles/:id
 * @desc    Update article
 * @access  Private (Admin/Agent only)
 */
router.put('/articles/:id', kbController.updateArticle);

/**
 * @route   DELETE /api/v1/kb/articles/:id
 * @desc    Delete article
 * @access  Private (Admin/Agent only)
 */
router.delete('/articles/:id', kbController.deleteArticle);

/**
 * @route   PUT /api/v1/kb/articles/:id/publish
 * @desc    Publish article
 * @access  Private (Admin/Agent only)
 */
router.put('/articles/:id/publish', kbController.publishArticle);

export default router;

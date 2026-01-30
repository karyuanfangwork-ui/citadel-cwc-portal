import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    startHRScreening,
    updateScreeningStatus,
    getScreeningDetails
} from '../controllers/screening.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// HR SCREENING ROUTES
// ============================================================================

/**
 * @route   POST /api/screening/requests/:id/start
 * @desc    Start HR screening (background and reference checks)
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/start', startHRScreening);

/**
 * @route   PUT /api/screening/requests/:id
 * @desc    Update HR screening status
 * @access  Private (HR Agent)
 */
router.put('/requests/:id', updateScreeningStatus);

/**
 * @route   GET /api/screening/requests/:id
 * @desc    Get HR screening details
 * @access  Private
 */
router.get('/requests/:id', getScreeningDetails);

export default router;

import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    scheduleInterview,
    submitInterviewFeedback,
    getInterviewDetails
} from '../controllers/interview.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// INTERVIEW MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   POST /api/interviews/requests/:id/schedule
 * @desc    Schedule interview with candidate
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/schedule', scheduleInterview);

/**
 * @route   POST /api/interviews/requests/:id/feedback
 * @desc    Submit interview feedback
 * @access  Private (Hiring Manager)
 */
router.post('/requests/:id/feedback', submitInterviewFeedback);

/**
 * @route   GET /api/interviews/requests/:id
 * @desc    Get interview details (schedule and feedback)
 * @access  Private
 */
router.get('/requests/:id', getInterviewDetails);

export default router;

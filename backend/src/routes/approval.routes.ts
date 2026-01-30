import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    routeToCEO,
    ceoDecision,
    markJobPosted,
    routeToManager,
    managerDecision
} from '../controllers/approval.controller';
import {
    uploadResume,
    getResumes,
    deleteResume,
    upload
} from '../controllers/resume.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// APPROVAL WORKFLOW ROUTES
// ============================================================================

/**
 * @route   POST /api/approvals/requests/:id/route-to-ceo
 * @desc    Route request to CEO for approval
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/route-to-ceo', routeToCEO);

/**
 * @route   POST /api/approvals/requests/:id/ceo-decision
 * @desc    CEO approve or reject request
 * @access  Private (CEO)
 */
router.post('/requests/:id/ceo-decision', ceoDecision);

/**
 * @route   POST /api/approvals/requests/:id/mark-job-posted
 * @desc    Mark request as job posted
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/mark-job-posted', markJobPosted);

/**
 * @route   POST /api/approvals/requests/:id/route-to-manager
 * @desc    Route request to hiring manager for review
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/route-to-manager', routeToManager);

/**
 * @route   POST /api/approvals/requests/:id/manager-decision
 * @desc    Hiring manager approve or request changes
 * @access  Private (Hiring Manager)
 */
router.post('/requests/:id/manager-decision', managerDecision);

// ============================================================================
// RESUME UPLOAD ROUTES
// ============================================================================

/**
 * @route   POST /api/approvals/requests/:id/upload-resume
 * @desc    Upload candidate resume
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/upload-resume', upload.single('file'), uploadResume);

/**
 * @route   GET /api/approvals/requests/:id/resumes
 * @desc    Get all candidate resumes for a request
 * @access  Private
 */
router.get('/requests/:id/resumes', getResumes);

/**
 * @route   DELETE /api/approvals/requests/:id/resumes/:resumeId
 * @desc    Delete a candidate resume
 * @access  Private (HR Agent)
 */
router.delete('/requests/:id/resumes/:resumeId', deleteResume);

export default router;

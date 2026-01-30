import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    uploadLOA,
    routeLOAForApproval,
    managerApproveLOA,
    markLOAIssued,
    uploadSignedLOA,
    markLOAAccepted,
    getLOADetails
} from '../controllers/loa.controller';
import { upload } from '../controllers/resume.controller';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// LOA MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   POST /api/loa/requests/:id/upload
 * @desc    Upload LOA document
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/upload', upload.single('file'), uploadLOA);

/**
 * @route   POST /api/loa/requests/:id/route-for-approval
 * @desc    Route LOA for manager approval
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/route-for-approval', routeLOAForApproval);

/**
 * @route   POST /api/loa/requests/:id/manager-approve
 * @desc    Manager approve or reject LOA
 * @access  Private (Hiring Manager)
 */
router.post('/requests/:id/manager-approve', managerApproveLOA);

/**
 * @route   POST /api/loa/requests/:id/mark-issued
 * @desc    Mark LOA as issued to candidate
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/mark-issued', markLOAIssued);

/**
 * @route   POST /api/loa/requests/:id/upload-signed
 * @desc    Upload signed LOA from candidate
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/upload-signed', upload.single('file'), uploadSignedLOA);

/**
 * @route   POST /api/loa/requests/:id/mark-accepted
 * @desc    Mark LOA as accepted (final step)
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/mark-accepted', markLOAAccepted);

/**
 * @route   GET /api/loa/requests/:id
 * @desc    Get LOA details
 * @access  Private
 */
router.get('/requests/:id', getLOADetails);

export default router;

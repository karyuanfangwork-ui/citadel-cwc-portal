import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    routeToCEO,
    ceoDecision,
    markJobPosted,
    routeToManager,
    managerDecision,
    entityDecision,
    routeToGroupCeoHr,
    groupCeoDecisionHr
} from '../controllers/approval.controller';
import {
    uploadResume,
    getResumes,
    deleteResume,
    batchUploadDocs,
    getCandidates,
    deleteCandidate,
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

/**
 * @route   POST /api/approvals/requests/:id/entity-decision
 * @desc    Entity approver approve or reject request
 * @access  Private (Entity Approver)
 */
router.post('/requests/:id/entity-decision', entityDecision);

/**
 * @route   POST /api/approvals/requests/:id/route-to-group-ceo-hr
 * @desc    Route HR hiring request to Group CEO for approval
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/route-to-group-ceo-hr', routeToGroupCeoHr);

/**
 * @route   POST /api/approvals/requests/:id/group-ceo-decision-hr
 * @desc    Group CEO approve or reject HR hiring request
 * @access  Private (Group CEO)
 */
router.post('/requests/:id/group-ceo-decision-hr', groupCeoDecisionHr);

// ============================================================================
// RESUME UPLOAD ROUTES
// ============================================================================

/**
 * @route   POST /api/approvals/requests/:id/upload-resume
 * @desc    Upload single candidate document
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/upload-resume', upload.single('file'), uploadResume);

/**
 * @route   POST /api/approvals/requests/:id/upload-candidate-docs
 * @desc    Batch upload candidate documents (multiple files)
 * @access  Private (HR Agent)
 */
router.post('/requests/:id/upload-candidate-docs', upload.array('files', 5), batchUploadDocs);

/**
 * @route   GET /api/approvals/requests/:id/candidates
 * @desc    Get all candidates for a request (with documents)
 * @access  Private
 */
router.get('/requests/:id/candidates', getCandidates);

/**
 * @route   DELETE /api/approvals/requests/:id/candidates/:candidateId
 * @desc    Delete a candidate and their documents
 * @access  Private (HR Agent)
 */
router.delete('/requests/:id/candidates/:candidateId', deleteCandidate);

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

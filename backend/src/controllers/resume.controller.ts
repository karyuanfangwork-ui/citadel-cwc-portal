import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadSingleFile } from '../middleware/upload.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import { hasRole } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// Shared S3-backed multer instance — used by loa.routes and approval.routes
export const upload = { single: (field: string) => uploadSingleFile(field) };

/**
 * Upload candidate resume
 * POST /requests/:id/upload-resume
 */
export const uploadResume = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params as { id: string };
        const { candidateName, notes } = req.body;
        const userId = (req as any).user?.id;
        const file = req.file as any;

        if (!file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        if (request.status !== 'JOB_POSTED') {
            return res.status(400).json({
                status: 'error',
                message: 'Can only upload resumes when request status is JOB_POSTED'
            });
        }

        const resume = await prisma.candidateResume.create({
            data: {
                requestId: id,
                fileName: file.originalname,
                fileUrl: file.key,   // S3 key
                fileSize: BigInt(file.size),
                mimeType: file.mimetype,
                uploadedById: userId,
                candidateName: candidateName || null,
                notes: notes || null
            }
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `Uploaded candidate resume: ${candidateName || file.originalname}`,
                isSystemGenerated: true
            }
        });

        res.json({
            status: 'success',
            data: { resume: { ...resume, fileSize: resume.fileSize.toString() } }
        });
    } catch (error) {
        console.error('Error uploading resume:', error);
        res.status(500).json({ status: 'error', message: 'Failed to upload resume' });
    }
};

/**
 * Get all candidate resumes for a request
 * GET /requests/:id/resumes
 */
export const getResumes = async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params as { id: string };

        // Check confidentiality: gate + log access to confidential request resumes
        const request = await prisma.request.findUnique({
            where: { id },
            select: {
                id: true,
                isConfidential: true,
                requesterId: true,
                referenceNumber: true,
                approvals: { select: { approverId: true } },
            },
        });
        if (request?.isConfidential && request.requesterId !== req.user?.id) {
            const canSeeConfidential = hasRole(req, 'ADMIN') || req.user?.permissions?.includes('request:confidential');
            const isDesignatedApprover = request.approvals?.some((a: any) => a.approverId === req.user?.id);
            if (!canSeeConfidential && !isDesignatedApprover) {
                return res.status(403).json({ status: 'error', message: 'Resumes for this confidential request are restricted' });
            }
            // Audit: log access by authorized non-requesters
            auditLog(req, 'CONFIDENTIAL_RESUME_ACCESS', 'request', request.id, {
                referenceNumber: request.referenceNumber,
                action: 'resume_list_view',
            }).catch(() => {});
        }

        const resumes = await prisma.candidateResume.findMany({
            where: { requestId: id },
            include: {
                uploadedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            status: 'success',
            data: { resumes: resumes.map(r => ({ ...r, fileSize: r.fileSize.toString() })) }
        });
    } catch (error) {
        console.error('Error fetching resumes:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch resumes' });
    }
};

/**
 * Delete a candidate resume
 * DELETE /requests/:id/resumes/:resumeId
 */
export const deleteResume = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id, resumeId } = req.params as { id: string; resumeId: string };
        const userId = (req as any).user?.id;

        const resume = await prisma.candidateResume.findUnique({
            where: { id: resumeId },
            include: { request: true, uploadedBy: true }
        });

        if (!resume) {
            return res.status(404).json({ status: 'error', message: 'Resume not found' });
        }
        if (resume.requestId !== id) {
            return res.status(400).json({ status: 'error', message: 'Resume does not belong to this request' });
        }
        if (resume.request.status !== 'JOB_POSTED') {
            return res.status(400).json({
                status: 'error',
                message: 'Can only delete resumes when request status is JOB_POSTED'
            });
        }

        // S3 deletion is not strictly required; record is deleted from DB
        await prisma.candidateResume.delete({ where: { id: resumeId } });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Deleted candidate resume: ${resume.candidateName || resume.fileName}`,
                isSystemGenerated: true
            }
        });

        res.json({ status: 'success', message: 'Resume deleted successfully' });
    } catch (error) {
        console.error('Error deleting resume:', error);
        res.status(500).json({ status: 'error', message: 'Failed to delete resume' });
    }
};

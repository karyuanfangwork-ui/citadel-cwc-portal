import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadSingleFile, uploadMultipleFiles } from '../middleware/upload.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { auditLog } from '../utils/audit';
import { hasRole } from '../middleware/auth.middleware';
import { resolveRequestId } from '../utils/resolve';

const prisma = new PrismaClient();

// Shared S3-backed multer instance — used by loa.routes and approval.routes
export const upload = {
    single: (field: string) => uploadSingleFile(field),
    array: (field: string, maxCount: number) => uploadMultipleFiles(field, maxCount),
};

/**
 * Upload candidate resume (single file, with candidate upsert)
 * POST /requests/:id/upload-resume
 */
export const uploadResume = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id: idOrRef } = req.params as { id: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const { candidateName, notes, documentType, candidateId } = req.body;
        const userId = (req as any).user?.id;
        const file = req.file as any;

        if (!file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const validDocTypes = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'];
        const docType = validDocTypes.includes(documentType) ? documentType : 'RESUME';

        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        if (request.status !== 'JOB_POSTED') {
            return res.status(400).json({
                status: 'error',
                message: 'Can only upload documents when request status is JOB_POSTED'
            });
        }

        // Find or create Candidate
        let candidate;
        if (candidateId) {
            candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
            if (!candidate || candidate.requestId !== id) {
                return res.status(400).json({ status: 'error', message: 'Candidate not found for this request' });
            }
        } else {
            const name = (candidateName || 'Unnamed Candidate').trim();
            candidate = await prisma.candidate.upsert({
                where: { unique_candidate_per_request: { requestId: id, fullName: name } },
                create: { requestId: id, fullName: name },
                update: {},
            });
        }

        // Check for duplicate doc type
        const existing = await prisma.candidateResume.findFirst({
            where: { candidateId: candidate.id, documentType: docType },
        });
        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `Document type ${docType} already exists for this candidate`,
                existingType: docType,
            });
        }

        const resume = await prisma.candidateResume.create({
            data: {
                requestId: id,
                candidateId: candidate.id,
                candidateName: candidate.fullName,
                fileName: file.originalname,
                fileUrl: file.key,
                fileSize: BigInt(file.size),
                mimeType: file.mimetype,
                uploadedById: userId,
                documentType: docType,
                notes: notes || null,
            },
            include: {
                uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                candidate: { select: { id: true, fullName: true } },
            },
        });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `Uploaded ${docType} for candidate "${candidate.fullName}"`,
                isSystemGenerated: true,
            },
        });

        res.json({
            status: 'success',
            data: { resume: { ...resume, fileSize: resume.fileSize.toString() } },
        });
    } catch (error) {
        console.error('Error uploading resume:', error);
        res.status(500).json({ status: 'error', message: 'Failed to upload resume' });
    }
};

/**
 * Batch upload candidate documents
 * POST /requests/:id/upload-candidate-docs
 */
export const batchUploadDocs = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id: idOrRef } = req.params as { id: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });
        const userId = (req as any).user?.id;
        const candidateName = req.body.candidateName?.trim();
        const candidateId = req.body.candidateId;
        const notes = req.body.notes || null;

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No files uploaded' });
        }

        // Validate request exists and is in JOB_POSTED status
        const request = await prisma.request.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }
        if (request.status !== 'JOB_POSTED') {
            return res.status(400).json({ status: 'error', message: 'Can only upload documents when request status is JOB_POSTED' });
        }

        // Parse docTypes from form fields
        let docTypes: string[] = [];
        try {
            docTypes = JSON.parse(req.body.docTypes || '[]');
        } catch { /* fallthrough */ }
        if (docTypes.length !== files.length) {
            return res.status(400).json({ status: 'error', message: `Expected ${files.length} docTypes, got ${docTypes.length}` });
        }

        const validTypes = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'];
        for (const dt of docTypes) {
            if (!validTypes.includes(dt)) {
                return res.status(400).json({ status: 'error', message: `Invalid document type: ${dt}` });
            }
        }

        // Find or create Candidate
        let candidate;
        if (candidateId) {
            candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
            if (!candidate || candidate.requestId !== id) {
                return res.status(400).json({ status: 'error', message: 'Candidate not found for this request' });
            }
        } else {
            const name = candidateName || 'Unnamed Candidate';
            candidate = await prisma.candidate.upsert({
                where: { unique_candidate_per_request: { requestId: id, fullName: name } },
                create: { requestId: id, fullName: name },
                update: {},
            });
        }

        // Check for duplicate doc types
        const existingDocs = await prisma.candidateResume.findMany({
            where: { candidateId: candidate.id },
            select: { documentType: true },
        });
        const existingTypes = new Set(existingDocs.map(d => d.documentType));
        const duplicates = docTypes.filter(dt => existingTypes.has(dt));
        if (duplicates.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: `Document types already exist for this candidate: ${duplicates.join(', ')}`,
                existingTypes: [...existingTypes],
            });
        }

        // Create all CandidateResume records in a transaction
        const results = await prisma.$transaction(
            files.map((file, i) =>
                prisma.candidateResume.create({
                    data: {
                        requestId: id,
                        candidateId: candidate!.id,
                        candidateName: candidate!.fullName,
                        fileName: file.originalname,
                        fileUrl: (file as any).key,
                        fileSize: BigInt(file.size),
                        mimeType: file.mimetype,
                        uploadedById: userId,
                        documentType: docTypes[i],
                        notes,
                    },
                    include: {
                        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                        candidate: { select: { id: true, fullName: true } },
                    },
                })
            )
        );

        // Activity log
        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: userId,
                authorName: `${(req as any).user?.firstName} ${(req as any).user?.lastName}`,
                authorRole: 'HR Agent',
                activityType: 'ATTACHMENT',
                message: `${files.length} documents uploaded for candidate "${candidate.fullName}" (${docTypes.join(', ')})`,
                isSystemGenerated: true,
            },
        });

        const serialized = results.map(r => ({ ...r, fileSize: r.fileSize.toString() }));
        res.status(201).json({ status: 'success', data: serialized });
    } catch (error) {
        console.error('Error batch uploading docs:', error);
        res.status(500).json({ status: 'error', message: 'Failed to upload documents' });
    }
};

/**
 * Get candidates for a request
 * GET /requests/:id/candidates
 */
export const getCandidates = async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id: idOrRef } = req.params as { id: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });

        const candidates = await prisma.candidate.findMany({
            where: { requestId: id },
            include: {
                documents: {
                    select: { id: true, documentType: true, fileName: true, fileUrl: true, fileSize: true, createdAt: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Serialize BigInt in documents
        const serialized = candidates.map(c => ({
            ...c,
            documents: c.documents.map(d => ({
                ...d,
                fileSize: d.fileSize?.toString() ?? '0',
            })),
        }));

        res.json({ status: 'success', data: serialized });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch candidates' });
    }
};

/**
 * Delete a candidate (cascades to documents)
 * DELETE /requests/:id/candidates/:candidateId
 */
export const deleteCandidate = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id: idOrRef, candidateId } = req.params as { id: string; candidateId: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });

        const candidate = await prisma.candidate.findFirst({
            where: { id: candidateId, requestId: id },
        });
        if (!candidate) {
            return res.status(404).json({ status: 'error', message: 'Candidate not found' });
        }

        await prisma.candidate.delete({ where: { id: candidateId } });

        await prisma.requestActivity.create({
            data: {
                requestId: id,
                authorId: (req as any).user?.id,
                authorName: `${(req as any).user?.firstName} ${(req as any).user?.lastName}`,
                authorRole: 'HR Agent',
                activityType: 'SYSTEM',
                message: `Deleted candidate "${candidate.fullName}" and all their documents`,
                isSystemGenerated: true,
            },
        });

        res.json({ status: 'success', message: 'Candidate deleted' });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({ status: 'error', message: 'Failed to delete candidate' });
    }
};

/**
 * Get all candidate resumes for a request
 * GET /requests/:id/resumes
 */
export const getResumes = async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id: idOrRef } = req.params as { id: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });

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
                },
                candidate: {
                    select: { id: true, fullName: true }
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
        const { id: idOrRef, resumeId } = req.params as { id: string; resumeId: string };
        const id = await resolveRequestId(idOrRef);
        if (!id) return res.status(404).json({ status: 'error', message: 'Request not found' });
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
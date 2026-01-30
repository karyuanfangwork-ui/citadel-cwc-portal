import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/resumes');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        // Generate unique filename: {uuid}_{timestamp}.{ext}
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `resume-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept only PDF, DOC, DOCX files
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

/**
 * Upload candidate resume
 * POST /requests/:id/upload-resume
 */
export const uploadResume = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params as { id: string };
        const { candidateName, notes } = req.body;
        const userId = (req as any).user?.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }

        // Get the request
        const request = await prisma.request.findUnique({
            where: { id }
        });

        if (!request) {
            // Delete uploaded file if request not found
            fs.unlinkSync(file.path);
            return res.status(404).json({
                status: 'error',
                message: 'Request not found'
            });
        }

        if (request.status !== 'JOB_POSTED') {
            // Delete uploaded file if wrong status
            fs.unlinkSync(file.path);
            return res.status(400).json({
                status: 'error',
                message: 'Can only upload resumes when request status is JOB_POSTED'
            });
        }

        // Create resume record
        const resume = await prisma.candidateResume.create({
            data: {
                requestId: id,
                fileName: file.originalname,
                fileUrl: `/uploads/resumes/${file.filename}`,
                fileSize: BigInt(file.size),
                mimeType: file.mimetype,
                uploadedById: userId,
                candidateName: candidateName || null,
                notes: notes || null
            }
        });

        // Create activity log
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

        // Convert BigInt to string for JSON serialization
        const resumeData = {
            ...resume,
            fileSize: resume.fileSize.toString()
        };

        res.json({
            status: 'success',
            data: { resume: resumeData }
        });
    } catch (error) {
        console.error('Error uploading resume:', error);

        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to upload resume'
        });
    }
};

/**
 * Get all candidate resumes for a request
 * GET /requests/:id/resumes
 */
export const getResumes = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params as { id: string };

        const resumes = await prisma.candidateResume.findMany({
            where: { requestId: id },
            include: {
                uploadedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Convert BigInt to string for JSON serialization
        const resumesData = resumes.map(resume => ({
            ...resume,
            fileSize: resume.fileSize.toString()
        }));

        res.json({
            status: 'success',
            data: { resumes: resumesData }
        });
    } catch (error) {
        console.error('Error fetching resumes:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch resumes'
        });
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

        // Get the resume
        const resume = await prisma.candidateResume.findUnique({
            where: { id: resumeId },
            include: { request: true, uploadedBy: true }
        });

        if (!resume) {
            return res.status(404).json({
                status: 'error',
                message: 'Resume not found'
            });
        }

        if (resume.requestId !== id) {
            return res.status(400).json({
                status: 'error',
                message: 'Resume does not belong to this request'
            });
        }

        // Only allow deletion if request is still in JOB_POSTED status
        if (resume.request.status !== 'JOB_POSTED') {
            return res.status(400).json({
                status: 'error',
                message: 'Can only delete resumes when request status is JOB_POSTED'
            });
        }

        // Delete file from filesystem
        const filePath = path.join(__dirname, '../../', resume.fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete database record
        await prisma.candidateResume.delete({
            where: { id: resumeId }
        });

        // Create activity log
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

        res.json({
            status: 'success',
            message: 'Resume deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting resume:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete resume'
        });
    }
};

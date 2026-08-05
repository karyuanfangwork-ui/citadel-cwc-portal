import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config';
import prisma from '../utils/prisma';

const TEST_EMAIL = 'request-policy-integration@test.local';
let authToken: string;
let userId: string;
let tenantId: string;
let itDeskId: string;
let hrDeskId: string;
let itTypeId: string;
let hrTypeId: string;
let itFormVersion: number;
let hrFormVersion: number;
let itCategoryId: string;
let draftTypeId: string | undefined;
const createdRequestIds: string[] = [];

beforeAll(async () => {
    const itType = await prisma.requestType.findFirstOrThrow({
        where: { code: 'GET_IT_HELP' },
        include: { serviceCategory: { include: { serviceDesk: true } } },
    });
    const hrType = await prisma.requestType.findFirstOrThrow({
        where: { code: 'HR_QUESTION' },
        include: { serviceCategory: { include: { serviceDesk: true } } },
    });

    tenantId = itType.serviceCategory.serviceDesk.tenantId!;
    itDeskId = itType.serviceCategory.serviceDesk.id;
    hrDeskId = hrType.serviceCategory.serviceDesk.id;
    itTypeId = itType.id;
    hrTypeId = hrType.id;
    itFormVersion = itType.formConfigVersion!;
    hrFormVersion = hrType.formConfigVersion!;
    itCategoryId = itType.serviceCategoryId;

    const user = await prisma.user.upsert({
        where: { email: TEST_EMAIL },
        update: { tenantId, isActive: true },
        create: {
            tenantId,
            email: TEST_EMAIL,
            passwordHash: await bcrypt.hash(crypto.randomUUID(), 4),
            firstName: 'Request',
            lastName: 'Policy Test',
            isActive: true,
        },
    });
    userId = user.id;
    authToken = jwt.sign(
        { userId: user.id, email: user.email, jti: crypto.randomUUID() },
        config.jwt.secret,
        { expiresIn: '1h' },
    );
});

afterAll(async () => {
    if (createdRequestIds.length > 0) {
        await prisma.requestActivity.deleteMany({ where: { requestId: { in: createdRequestIds } } });
        await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
    if (draftTypeId) {
        await prisma.requestType.deleteMany({ where: { id: draftTypeId } });
    }
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
});

describe('Task 13 request creation HTTP policy', () => {
    it('returns the same generic 404 for a cross-desk request type', async () => {
        const response = await request(app)
            .post('/api/v1/requests')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                serviceDeskId: hrDeskId,
                requestTypeId: itTypeId,
                formVersion: itFormVersion,
                summary: 'Cross-desk request must fail',
                customFields: {},
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Request type not found');
    });

    it('does not allow an active but unpublished request type', async () => {
        const draft = await prisma.requestType.create({
            data: {
                tenantId,
                serviceCategoryId: itCategoryId,
                code: `POLICY_DRAFT_${crypto.randomUUID()}`,
                name: 'Policy Draft Test',
                isActive: true,
                lifecycleStatus: 'DRAFT',
            },
        });
        draftTypeId = draft.id;

        const response = await request(app)
            .post('/api/v1/requests')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                serviceDeskId: itDeskId,
                requestTypeId: draft.id,
                formVersion: draft.formConfigVersion!,
                summary: 'Draft request must fail',
                customFields: {},
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Request type not found');
    });

    it('forces HR confidentiality despite a false client assertion', async () => {
        const response = await request(app)
            .post('/api/v1/requests')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                serviceDeskId: hrDeskId,
                requestTypeId: hrTypeId,
                formVersion: hrFormVersion,
                summary: 'Confidential HR request',
                description: 'Sensitive employee matter',
                isConfidential: false,
                customFields: {
                    field_1776666757696: 'Sensitive employee question',
                    field_1776666848303: 'Private details supplied to HR',
                },
            });

        expect(response.status).toBe(201);
        const created = response.body.data?.request ?? response.body.request;
        createdRequestIds.push(created.id);

        const stored = await prisma.request.findUniqueOrThrow({
            where: { id: created.id },
            select: { isConfidential: true, serviceDeskId: true, requestTypeId: true },
        });
        expect(stored).toEqual({
            isConfidential: true,
            serviceDeskId: hrDeskId,
            requestTypeId: hrTypeId,
        });
    });
});

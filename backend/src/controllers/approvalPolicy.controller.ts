/**
 * P5-06: Approval Policy Controller
 *
 * REST API for managing approval policies and their steps.
 */

import { Request, Response } from 'express';
import { approvalPolicyService } from '../services/approvalPolicy.service';

// List policies for a request type
export async function listPolicies(req: Request, res: Response) {
    try {
        const requestTypeId = req.params.requestTypeId as string;
        const policies = await approvalPolicyService.listPolicies(requestTypeId);
        res.json(policies);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

// Get a single policy
export async function getPolicy(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const policy = await approvalPolicyService.getPolicy(id);
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }
        res.json(policy);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

// Create a new policy
export async function createPolicy(req: Request, res: Response) {
    try {
        const { name, description, requestTypeId, isActive, priority, steps } = req.body as {
            name: string;
            description?: string;
            requestTypeId: string;
            isActive?: boolean;
            priority?: number;
            steps: Array<{
                stepOrder: number;
                approverType: string;
                approverId?: string;
                roleId?: string;
                departmentId?: string;
                entityId?: string;
                teamId?: string;
                label?: string;
                autoApproveIf?: string;
                timeoutHours?: number;
            }>;
        };

        if (!name || !requestTypeId) {
            return res.status(400).json({ error: 'name and requestTypeId are required' });
        }

        if (!steps || steps.length === 0) {
            return res.status(400).json({ error: 'At least one step is required' });
        }

        const policy = await approvalPolicyService.createPolicy({
            name,
            description,
            requestTypeId,
            isActive,
            priority,
            steps: steps.map(s => ({
                ...s,
                approverType: s.approverType as 'ROLE' | 'DEPARTMENT' | 'ENTITY' | 'USER' | 'TEAM' | 'AUTO',
            })),
        });

        res.status(201).json(policy);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

// Update a policy
export async function updatePolicy(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        const { name, description, isActive, priority, steps } = req.body as {
            name?: string;
            description?: string;
            isActive?: boolean;
            priority?: number;
            steps?: Array<{
                stepOrder: number;
                approverType: string;
                approverId?: string;
                roleId?: string;
                departmentId?: string;
                entityId?: string;
                teamId?: string;
                label?: string;
                autoApproveIf?: string;
                timeoutHours?: number;
            }>;
        };

        const policy = await approvalPolicyService.updatePolicy(id, {
            name,
            description,
            isActive,
            priority,
            steps: steps?.map(s => ({
                ...s,
                approverType: s.approverType as 'ROLE' | 'DEPARTMENT' | 'ENTITY' | 'USER' | 'TEAM' | 'AUTO',
            })),
        });

        res.json(policy);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Policy not found' });
        }
        res.status(500).json({ error: error.message });
    }
}

// Delete a policy
export async function deletePolicy(req: Request, res: Response) {
    try {
        const id = req.params.id as string;
        await approvalPolicyService.deletePolicy(id);
        res.status(204).send();
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Policy not found' });
        }
        res.status(500).json({ error: error.message });
    }
}

// Resolve the active policy for a request type (public, for policy resolution)
export async function resolvePolicy(req: Request, res: Response) {
    try {
        const requestTypeId = req.params.requestTypeId as string;
        const policy = await approvalPolicyService.resolvePolicy(requestTypeId);
        res.json(policy || null);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
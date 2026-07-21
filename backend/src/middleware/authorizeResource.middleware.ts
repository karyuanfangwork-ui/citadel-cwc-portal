/**
 * Authorize Resource Middleware — P02 Task 8
 *
 * Express middleware that uses the central policy service to authorize
 * access to a resource. Loads the resource scope, calls `authorize()`,
 * and either proceeds or returns 404 (resource not found) / 403 (forbidden).
 *
 * Usage:
 *   router.get('/requests/:id',
 *     authenticate,
 *     authorizeResource(loadRequestScopeFromParam('id'), 'read'),
 *     requestController.getById
 *   );
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { policyService } from '../security/policy.service';
import { principalFromAuth } from '../security/resource-scope.service';
import { PolicyAction, ResourceDescriptor, ScopeLoader } from '../security/policy.types';

/**
 * Create an authorization middleware for a given scope loader and action.
 *
 * @param loadScope - Function that loads the resource descriptor from the request
 * @param action - The policy action being attempted
 */
export function authorizeResource(loadScope: ScopeLoader, action: PolicyAction) {
    return async (req: AuthRequest, _res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError('Authentication required', 401));
            }

            const principal = principalFromAuth(req.user);
            const resource = await loadScope(req, principal);

            // If the resource doesn't have an ID, it wasn't found
            if (!resource.id) {
                return next(new AppError('Resource not found', 404));
            }

            const decision = policyService.authorize(principal, action, resource);

            if (!decision.allowed) {
                // Return 404 rather than 403 to avoid leaking resource existence
                return next(new AppError('Resource not found', 404));
            }

            // Attach the decision and resource to the request for downstream use
            (req as any).policyDecision = decision;
            (req as any).resourceDescriptor = resource;

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Helper: Create a scope loader that loads a request by a param.
 */
export function loadRequestScopeFromParam(paramName: string = 'id') {
    return async (req: AuthRequest, principal: any): Promise<ResourceDescriptor> => {
        const { loadRequestScope } = await import('../security/resource-scope.service');
        const id = String((req.params as any)[paramName]);
        return loadRequestScope(id, principal);
    };
}

/**
 * Helper: Create a scope loader that loads a notification by a param.
 */
export function loadNotificationScopeFromParam(paramName: string = 'id') {
    return async (req: AuthRequest, principal: any): Promise<ResourceDescriptor> => {
        const { loadNotificationScope } = await import('../security/resource-scope.service');
        const id = String((req.params as any)[paramName]);
        return loadNotificationScope(id, principal);
    };
}
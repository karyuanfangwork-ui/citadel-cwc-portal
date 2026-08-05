import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { creditScopeService } from '../services/creditScope.service';

type DocumentAccessAction = 'read' | 'update' | 'delete' | 'download' | 'verify';

export function assertCreditDocumentAccess(_options: { action: DocumentAccessAction }) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const documentId = String(req.params.id || '');
      if (!documentId) throw new AppError('Document id is required', 400);

      await creditScopeService.assertCanAccessDocument(req.user, documentId);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function assertApplicationDocumentAccess() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const applicationId = String(req.params.applicationId || '');
      if (!applicationId) throw new AppError('Application id is required', 400);

      await creditScopeService.assertCanAccessApplication(req.user, applicationId);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

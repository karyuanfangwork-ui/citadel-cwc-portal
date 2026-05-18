import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PiiReadLogService } from '../services/piiReadLog.service';

/**
 * PII fields that should be logged when accessed.
 */
const PII_FIELDS = ['nric', 'nricPassport', 'bankAccount', 'bankName', 'accountNumber',
  'annualRevenue', 'totalAssets', 'totalLiabilities', 'netWorth',
  'financialDetails', 'taxId', 'passportNumber'];

/**
 * Middleware that logs PII read access.
 *
 * Wraps a controller handler so that PII field reads are automatically logged
 * to the PiiReadLog table. The middleware inspects the response data for known
 * PII field keys and logs each one that is present.
 *
 * Usage:
 *   router.get('/borrowers/:id', logPiiRead, controller.getBorrower);
 *
 * Or as a wrapper:
 *   const withPiiLog = piiReadLogMiddleware();
 *   router.get('/borrowers/:id', withPiiLog, controller.getBorrower);
 */
export function piiReadLogMiddleware(resourceType?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Intercept the response to log PII field access
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Attempt to log PII access asynchronously (don't block the response)
      if (req.user?.id && body?.status === 'success' && body?.data) {
        const data = body.data;
        const resolvedResourceType = resourceType || inferResourceType(req.path);
        const resourceId = (req.params.id || req.params.borrowerProfileId || '') as string;

        logPiiFields(req.user.id, resolvedResourceType, resourceId, data).catch(
          (err) => {
            console.warn('Failed to log PII read access:', err.message);
          },
        );
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Recursively scan a response object for PII fields and log each one found.
 */
async function logPiiFields(
  userId: string,
  resourceType: string,
  resourceId: string,
  data: any,
): Promise<void> {
  if (!data || typeof data !== 'object') return;

  const piiFieldsFound: string[] = [];
  findPiiFields(data, piiFieldsFound);

  // Deduplicate
  const uniqueFields = [...new Set(piiFieldsFound)];

  for (const field of uniqueFields) {
    await PiiReadLogService.logPiiAccess(userId, resourceType, resourceId, field);
  }
}

/**
 * Recursively find PII field keys in an object.
 */
function findPiiFields(obj: any, found: string[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findPiiFields(item, found);
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    if (PII_FIELDS.includes(key) && obj[key] != null && obj[key] !== '') {
      found.push(key);
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      findPiiFields(obj[key], found);
    }
  }
}

/**
 * Infer the resource type from the request path.
 */
function inferResourceType(path: string): string {
  if (path.includes('/borrowers')) return 'BorrowerProfile';
  if (path.includes('/applications')) return 'CreditApplication';
  if (path.includes('/documents')) return 'CreditDocument';
  if (path.includes('/financial')) return 'FinancialStatement';
  if (path.includes('/directors')) return 'Director';
  if (path.includes('/shareholders')) return 'Shareholder';
  if (path.includes('/guarantees')) return 'Guarantee';
  if (path.includes('/collateral')) return 'Collateral';
  return 'Unknown';
}

export default piiReadLogMiddleware;
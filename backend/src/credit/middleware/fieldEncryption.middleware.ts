import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CreditEncryptionService } from '../services/encryption.service';

// ---------------------------------------------------------------------------
// §2.9 — Field-encryption middleware for BorrowerProfile PII fields
// ---------------------------------------------------------------------------
// Automatically encrypts sensitive fields on write and decrypts on read.
// The encrypted values are stored in annualIncomeEncrypted, netWorthEncrypted,
// and sourceOfWealthEncrypted columns.
//
// Usage:
//   POST/PATCH /borrowers — auto-encrypt annualIncome, netWorth, sourceOfWealth
//   GET /borrowers — auto-decrypt into response (with masking for non-admin)
// ---------------------------------------------------------------------------

/**
 * Encrypt sensitive BorrowerProfile fields in the request body before
 * they hit the service layer. Maps plaintext values to encrypted field names.
 */
export function encryptBorrowerFields() {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    // Only encrypt on write methods (POST, PATCH, PUT)
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
      return next();
    }

    const body = req.body;
    if (!body) return next();

    const encrypted = CreditEncryptionService.encryptBorrowerFields({
      annualIncome: body.annualIncome,
      netWorth: body.netWorth,
      sourceOfWealth: body.sourceOfWealth ?? body.sourceOfWealth,
    });

    // Replace plaintext fields with encrypted versions in the body
    if (encrypted.annualIncomeEncrypted !== undefined) {
      body.annualIncomeEncrypted = encrypted.annualIncomeEncrypted;
      // Zero out the plaintext decimal field — don't store plain values
      body.annualIncome = null;
    }
    if (encrypted.netWorthEncrypted !== undefined) {
      body.netWorthEncrypted = encrypted.netWorthEncrypted;
      body.netWorth = null;
    }
    if (encrypted.sourceOfWealthEncrypted !== undefined) {
      body.sourceOfWealthEncrypted = encrypted.sourceOfWealthEncrypted;
      body.sourceOfWealth = null;
    }

    next();
  };
}

/**
 * Decrypt encrypted BorrowerProfile fields in the response.
 * Attaches decrypted values back to the response object.
 * For non-admin/non-privileged roles, masks the decrypted values.
 */
export function decryptBorrowerFields() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Only decrypt on GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      try {
        const data = body?.data;

        // Handle single BorrowerProfile (GET /borrowers/:id returns { data: { profile: ... } })
        const profile = data?.profile ?? data;

        if (profile?.annualIncomeEncrypted || profile?.netWorthEncrypted || profile?.sourceOfWealthEncrypted) {
          const decrypted = CreditEncryptionService.decryptBorrowerFields(profile);

          // Determine if the user should see full values or masked
          const shouldMask = !req.user?.roles?.some(r =>
            ['ADMIN', 'CREDIT_ADMIN', 'CREDIT_MANAGER'].includes(r)
          );
          const shouldMaskPermission = !req.user?.permissions?.includes('credit:admin');

          if (shouldMask && shouldMaskPermission) {
            // Mask sensitive values — show asterisks with last chars
            profile.annualIncome = decrypted.annualIncome ? `***${decrypted.annualIncome.slice(-4)}` : null;
            profile.netWorth = decrypted.netWorth ? `***${decrypted.netWorth.slice(-4)}` : null;
            profile.sourceOfWealth = decrypted.sourceOfWealth ?? null;
          } else {
            // Full access — show decrypted values
            profile.annualIncome = decrypted.annualIncome;
            profile.netWorth = decrypted.netWorth;
            profile.sourceOfWealth = decrypted.sourceOfWealth;
          }

          // Remove encrypted blobs from response
          delete profile.annualIncomeEncrypted;
          delete profile.netWorthEncrypted;
          delete profile.sourceOfWealthEncrypted;
        }

        // Handle list of BorrowerProfiles
        if (Array.isArray(data?.borrowerProfiles)) {
          for (const bp of data.borrowerProfiles) {
            if (bp.annualIncomeEncrypted || bp.netWorthEncrypted || bp.sourceOfWealthEncrypted) {
              const decrypted = CreditEncryptionService.decryptBorrowerFields(bp);
              bp.annualIncome = decrypted.annualIncome;
              bp.netWorth = decrypted.netWorth;
              bp.sourceOfWealth = decrypted.sourceOfWealth;
              delete bp.annualIncomeEncrypted;
              delete bp.netWorthEncrypted;
              delete bp.sourceOfWealthEncrypted;
            }
          }
        }

        // Handle paginated results
        if (Array.isArray(data?.items)) {
          for (const item of data.items) {
            if (item.borrowerProfile?.annualIncomeEncrypted || item.borrowerProfile?.netWorthEncrypted) {
              const decrypted = CreditEncryptionService.decryptBorrowerFields(item.borrowerProfile);
              item.borrowerProfile.annualIncome = decrypted.annualIncome;
              item.borrowerProfile.netWorth = decrypted.netWorth;
              item.borrowerProfile.sourceOfWealth = decrypted.sourceOfWealth;
              delete item.borrowerProfile.annualIncomeEncrypted;
              delete item.borrowerProfile.netWorthEncrypted;
              delete item.borrowerProfile.sourceOfWealthEncrypted;
            }
          }
        }
      } catch (err) {
        // If decryption fails, log but don't crash — return encrypted data as-is
        console.error('[§2.9] Decryption middleware error:', err);
      }

      return originalJson(body);
    };

    next();
  };
}
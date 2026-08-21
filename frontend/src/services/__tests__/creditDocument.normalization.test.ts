import { describe, expect, it } from 'vitest';
import { normalizeCreditDocument } from '../credit.service';

describe('normalizeCreditDocument', () => {
  it('maps the backend classification and verification fields for Borrower 360', () => {
    const document = normalizeCreditDocument({
      id: 'doc-1',
      borrowerProfileId: 'borrower-1',
      classification: 'BANK_STATEMENT',
      fileName: 'statement.pdf',
      filePath: 'borrowers/statement.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      verificationStatus: 'PENDING',
      createdAt: '2026-08-21T00:00:00.000Z',
    });

    expect(document.documentType).toBe('BANK_STATEMENT');
    expect(document.status).toBe('PENDING');
    expect(document.uploadedAt).toBe('2026-08-21T00:00:00.000Z');
    expect(document.rejectionReason).toBeNull();
  });
});

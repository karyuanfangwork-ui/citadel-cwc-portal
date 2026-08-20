import { useState, useCallback } from 'react';
import creditService from '../services/credit.service';

type DupState = 'idle' | 'checking' | 'clear' | 'duplicate' | 'failed';

/**
 * Shared duplicate-check logic for borrower creation flows.
 * Used by CreateBorrowerPage and CreditApplicationCreate.
 */
export function useDuplicateCheck() {
  const [dupCheck, setDupCheck] = useState<DupState>('idle');
  const [dupBorrowerId, setDupBorrowerId] = useState<string | null>(null);
  const [dupError, setDupError] = useState<string | null>(null);

  const runCheck = useCallback(async (params: { nric?: string; ssm?: string }) => {
    const identifier = params.nric || params.ssm;
    if (!identifier?.trim()) return;
    setDupCheck('checking');
    setDupError(null);
    try {
      const result = await creditService.checkDuplicateBorrower(
        params.nric ? { nric: params.nric } : { ssm: params.ssm }
      );
      if (result.exists && result.borrowerId) {
        setDupCheck('duplicate');
        setDupBorrowerId(result.borrowerId);
      } else {
        setDupCheck('clear');
        setDupBorrowerId(null);
      }
    } catch {
      setDupCheck('failed');
      setDupBorrowerId(null);
      setDupError('Duplicate check failed. Retry before continuing.');
    }
  }, []);

  const reset = useCallback(() => {
    setDupCheck('idle');
    setDupBorrowerId(null);
    setDupError(null);
  }, []);

  return { dupCheck, dupBorrowerId, dupError, runCheck, reset };
}

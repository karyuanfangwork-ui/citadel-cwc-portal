import { useState, useEffect } from 'react';
import creditService from '../services/credit.service';

/**
 * P2-2: Processing lane hook — fetches lane + tabs for an application.
 *
 * - `lane`: 'PERSONAL_FAST' | 'SME' | 'CORPORATE'
 * - `reason`: human-readable explanation
 * - `requiredApproverCount`: 2 for PERSONAL_FAST/SME, -1 for CORPORATE (use matrix)
 * - `tabs`: ordered list of tab IDs visible for this lane + feature flags
 * - `loading`: true while fetching
 */
export function useApplicationLane(applicationId: string | undefined) {
  const [lane, setLane] = useState<string>('CORPORATE');
  const [reason, setReason] = useState<string>('');
  const [requiredApproverCount, setRequiredApproverCount] = useState<number>(-1);
  const [tabs, setTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    creditService.getApplicationTabs(applicationId)
      .then(data => {
        if (cancelled) return;
        setLane(data.lane);
        setReason(data.reason);
        setTabs(data.tabs);
        // Derive approver count from lane (we could also fetch it from a separate endpoint)
        if (data.lane === 'PERSONAL_FAST' || data.lane === 'SME') {
          setRequiredApproverCount(2);
        } else {
          setRequiredApproverCount(-1); // Use approval matrix
        }
      })
      .catch(() => {
        // Non-critical — defaults to CORPORATE lane
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [applicationId]);

  /** Re-evaluate and persist the lane (call after amount/borrowerType changes). */
  const reEvaluate = async () => {
    if (!applicationId) return;
    const data = await creditService.reEvaluateLane(applicationId);
    setLane(data.lane);
    setReason(data.reason);
    setRequiredApproverCount(data.requiredApproverCount);
    return data;
  };

  return { lane, reason, requiredApproverCount, tabs, loading, reEvaluate };
}
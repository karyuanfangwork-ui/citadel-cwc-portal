import { useEffect, useState } from 'react';
import { requestStatusService, type RequestStatusDefinition } from '../services/requestStatusService';

export function useWorkflowStatusDefinitions(workflowTypeId: string, readOnly: boolean) {
  const [definitions, setDefinitions] = useState<RequestStatusDefinition[]>([]);
  const [loading, setLoading] = useState(Boolean(workflowTypeId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!workflowTypeId) {
      setDefinitions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void requestStatusService.getActive(undefined, workflowTypeId)
      .then((result) => {
        if (!cancelled) setDefinitions(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load status definitions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workflowTypeId, readOnly]);

  return { definitions, loading, error };
}

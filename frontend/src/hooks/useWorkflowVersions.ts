import { useCallback, useEffect, useState } from 'react';
import workflowVersionService, { type WorkflowSummary } from '../services/workflow-version.service';

export function useWorkflowVersions() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workflowVersionService.listWorkflows();
      setWorkflows(result.workflows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { workflows, loading, error, reload };
}

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmService from '../src/services/crm.service';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const CrmWorkflowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [execTotal, setExecTotal] = useState(0);
  const [execPage, setExecPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'config' | 'history'>('config');

  const loadWorkflow = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const wf = await crmService.getWorkflow(id);
      setWorkflow(wf);
    } catch (err) {
      console.error('Failed to load workflow', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadExecutions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await crmService.getWorkflowExecutions(id, execPage, 10);
      setExecutions(res.executions);
      setExecTotal(res.total);
    } catch (err) {
      console.error('Failed to load executions', err);
    }
  }, [id, execPage]);

  useEffect(() => { loadWorkflow(); }, [loadWorkflow]);
  useEffect(() => { if (tab === 'history') loadExecutions(); }, [tab, loadExecutions]);

  const handleToggle = async () => {
    if (!id) return;
    try {
      await crmService.toggleWorkflow(id);
      loadWorkflow();
    } catch (err) {
      console.error('Failed to toggle workflow', err);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this workflow?')) return;
    try {
      await crmService.deleteWorkflow(id);
      navigate('/crm/workflows');
    } catch (err) {
      console.error('Failed to delete workflow', err);
    }
  };

  const formatEvent = (trigger: any) => {
    const map: Record<string, string> = {
      'lead.created': 'Lead Created',
      'lead.status.changed': 'Lead Status Changed',
      'opportunity.stage.changed': 'Deal Stage Changed',
      'opportunity.created': 'Opportunity Created',
      'activity.created': 'Activity Created',
      'lead.stale': 'Lead Stale',
    };
    return map[trigger?.event] || trigger?.event || '—';
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  if (!workflow) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Workflow not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/crm/workflows')} className="text-sm text-brand-600 hover:underline mb-1">← Back to Workflows</button>
            <h1 className="text-2xl font-bold text-gray-900">{workflow.name}</h1>
            {workflow.description && <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleToggle} className={`px-4 py-2 rounded-lg text-sm font-medium ${workflow.isActive ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
              {workflow.isActive ? 'Pause' : 'Activate'}
            </button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100">
              Delete
            </button>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {workflow.isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="text-xs text-gray-400">Priority: {workflow.executionOrder}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-4 border-b">
          <button onClick={() => setTab('config')} className={`pb-2 text-sm font-medium ${tab === 'config' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Configuration</button>
          <button onClick={() => setTab('history')} className={`pb-2 text-sm font-medium ${tab === 'history' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>Execution History</button>
        </div>

        {tab === 'config' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Trigger</h3>
              <div className="text-sm font-medium">{formatEvent(workflow.trigger)}</div>
              {workflow.trigger?.conditions?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {workflow.trigger.conditions.map((c: any, i: number) => (
                    <div key={i} className="text-sm text-gray-600">{c.field} {c.op} {String(c.value)}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Actions ({(workflow.actions || []).length})</h3>
              <div className="space-y-3">
                {(workflow.actions || []).map((a: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="text-sm font-medium">{a.type?.replace(/_/g, ' ')}</div>
                    {Object.entries(a.config || {}).map(([k, v]) => (
                      <div key={k} className="text-xs text-gray-500 ml-2">{k}: {String(v)}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Details</h3>
              <div className="text-sm text-gray-600">Created: {new Date(workflow.createdAt).toLocaleString()}</div>
              <div className="text-sm text-gray-600">Created by: {workflow.user?.firstName} {workflow.user?.lastName}</div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {executions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No executions yet</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Started</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {executions.map((exec: any) => (
                    <tr key={exec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[exec.status] || 'bg-gray-100 text-gray-600'}`}>{exec.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{exec.triggerEntity}</td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{exec.triggerEvent}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(exec.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{exec.completedAt ? new Date(exec.completedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrmWorkflowDetail;
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import { useAuth } from '../src/context/AuthContext';

const CrmWorkflows: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await crmService.listWorkflows(page, 20);
      setWorkflows(res.workflows);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  const handleToggle = async (id: string) => {
    try {
      await crmService.toggleWorkflow(id);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to toggle workflow', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workflow? This cannot be undone.')) return;
    try {
      await crmService.deleteWorkflow(id);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to delete workflow', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const t = await crmService.getWorkflowTemplates();
      setTemplates(t);
      setShowTemplates(true);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const createFromTemplate = async (template: any) => {
    try {
      await crmService.createWorkflow({
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        actions: template.actions,
      });
      setShowTemplates(false);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to create workflow from template', err);
    }
  };

  const formatEvent = (trigger: any) => {
    const eventMap: Record<string, string> = {
      'lead.created': 'Lead Created',
      'lead.status.changed': 'Lead Status Changed',
      'opportunity.stage.changed': 'Deal Stage Changed',
      'opportunity.created': 'Opportunity Created',
      'activity.created': 'Activity Created',
      'lead.stale': 'Lead Stale',
    };
    return eventMap[trigger?.event] || trigger?.event || 'Unknown';
  };

  const statusColor = (isActive: boolean) => isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-gray-500 mb-1">
              <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-[#006a61] transition-colors">CRM</Link>
              <span className="text-gray-400">›</span>
              <span className="font-bold text-[#006a61]">Workflows</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
            <p className="text-sm text-gray-500 mt-1">Define trigger rules and automated actions for your CRM</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadTemplates} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              From Template
            </button>
            <button onClick={() => navigate('/crm/workflows/new')} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
              + New Workflow
            </button>
          </div>
        </div>

        {showTemplates && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Workflow Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t, i) => (
                <div key={i} className="border rounded-lg p-4 hover:border-brand-400 transition-colors cursor-pointer" onClick={() => createFromTemplate(t)}>
                  <h3 className="font-medium text-sm">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{formatEvent(t.trigger)}</span>
                    <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{t.actions.length} action{t.actions.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowTemplates(false)} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Close</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-gray-300">account_tree</span>
            <p className="text-gray-500 mt-3">No workflows yet. Create one from a template or build from scratch.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Trigger</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/crm/workflows/${wf.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-gray-900">{wf.name}</div>
                      {wf.description && <div className="text-xs text-gray-500 mt-0.5">{wf.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{formatEvent(wf.trigger)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(wf.actions as any[])?.map((a: any, i: number) => (
                          <span key={i} className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{a.type?.replace('_', ' ')}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{wf.executionOrder}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(wf.isActive)}`}>
                        {wf.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleToggle(wf.id); }} className="text-xs text-brand-600 hover:underline mr-3">
                        {wf.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }} className="text-xs text-red-500 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrmWorkflows;
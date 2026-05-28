import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CrmNav from '../src/components/CrmNav';
import crmService from '../src/services/crm.service';

const TRIGGER_EVENTS = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.status.changed', label: 'Lead Status Changed' },
  { value: 'opportunity.created', label: 'Opportunity Created' },
  { value: 'opportunity.stage.changed', label: 'Deal Stage Changed' },
  { value: 'activity.created', label: 'Activity Created' },
  { value: 'lead.stale', label: 'Lead Stale (No Activity)' },
];

const CONDITION_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is one of' },
];

const ACTION_TYPES = [
  { value: 'CREATE_TASK', label: 'Create Task', description: 'Create a follow-up task' },
  { value: 'SEND_NOTIFICATION', label: 'Send Notification', description: 'Send SSE/email notification' },
  { value: 'UPDATE_FIELD', label: 'Update Field', description: 'Update a field on the entity' },
  { value: 'REASSIGN_OWNER', label: 'Reassign Owner', description: 'Change the owner of the record' },
];

interface Condition { field: string; op: string; value: string; }
interface Action { type: string; config: Record<string, string>; }

const CrmWorkflowBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addCondition = () => setConditions([...conditions, { field: '', op: 'eq', value: '' }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, key: keyof Condition, val: string) => {
    const updated = [...conditions];
    updated[i] = { ...updated[i], [key]: val };
    setConditions(updated);
  };

  const addAction = () => setActions([...actions, { type: 'CREATE_TASK', config: {} }]);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, key: string, val: string) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], [key]: val };
    setActions(updated);
  };
  const updateActionConfig = (i: number, key: string, val: string) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], config: { ...updated[i].config, [key]: val } };
    setActions(updated);
  };

  const handleSave = async () => {
    if (!name || !triggerEvent || actions.length === 0) {
      setError('Name, trigger, and at least one action are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crmService.createWorkflow({
        name,
        description: description || undefined,
        trigger: { event: triggerEvent, conditions: conditions.filter(c => c.field && c.value) },
        actions: actions.map(a => ({ type: a.type, config: a.config })),
        executionOrder: 0,
      });
      navigate('/crm/workflows');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ['Trigger', 'Conditions', 'Actions', 'Review & Save'];
  const canProceed = () => {
    if (step === 1) return !!triggerEvent;
    if (step === 2) return true; // conditions optional
    if (step === 3) return actions.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CrmNav />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">New Workflow</h1>
        <p className="text-sm text-gray-500 mb-6">Build an automated workflow in 4 steps</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {stepLabels.map((label, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-1.5 ${step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${step > i + 1 ? 'bg-green-100 text-green-700' : step === i + 1 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                <span className="text-sm hidden sm:inline">{label}</span>
              </div>
              {i < 3 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        {/* Step 1: Trigger */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Choose a Trigger Event</h2>
            <p className="text-sm text-gray-500 mb-4">What event should start this workflow?</p>
            <div className="space-y-3">
              {TRIGGER_EVENTS.map(ev => (
                <label key={ev.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${triggerEvent === ev.value ? 'border-brand-500 bg-brand-50' : 'hover:bg-gray-50'}`}>
                  <input type="radio" name="trigger" value={ev.value} checked={triggerEvent === ev.value} onChange={() => setTriggerEvent(ev.value)} className="accent-brand-600" />
                  <span className="text-sm font-medium">{ev.label}</span>
                  <span className="text-xs text-gray-400">{ev.value}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Conditions */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-2">Set Conditions (Optional)</h2>
            <p className="text-sm text-gray-500 mb-4">Only run the workflow when these conditions are met</p>
            {conditions.length === 0 && <p className="text-sm text-gray-400 mb-3">No conditions — workflow will run on every trigger event</p>}
            {conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 items-center mb-3">
                <input type="text" placeholder="Field (e.g. status)" value={cond.field} onChange={e => updateCondition(i, 'field', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <select value={cond.op} onChange={e => updateCondition(i, 'op', e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  {CONDITION_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <input type="text" placeholder="Value" value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
              </div>
            ))}
            <button onClick={addCondition} className="text-sm text-brand-600 hover:underline mt-2">+ Add Condition</button>
          </div>
        )}

        {/* Step 3: Actions */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Add Actions</h2>
            <p className="text-sm text-gray-500 mb-4">What should happen when this workflow triggers?</p>
            {actions.map((action, i) => (
              <div key={i} className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <select value={action.type} onChange={e => updateAction(i, 'type', e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-medium">
                    {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
                  </select>
                  <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                </div>
                <div className="text-xs text-gray-500 mb-2">{ACTION_TYPES.find(at => at.value === action.type)?.description}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {action.type === 'CREATE_TASK' && (
                    <>
                      <input type="text" placeholder="Task subject (use {{field}} for variables)" value={action.config.subject || ''} onChange={e => updateActionConfig(i, 'subject', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                      <select value={action.config.assignTo || ''} onChange={e => updateActionConfig(i, 'assignTo', e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">Assign to...</option>
                        <option value="owner">Record Owner</option>
                        <option value="manager">Owner's Manager</option>
                      </select>
                    </>
                  )}
                  {action.type === 'SEND_NOTIFICATION' && (
                    <>
                      <input type="text" placeholder="Notification title" value={action.config.title || ''} onChange={e => updateActionConfig(i, 'title', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="text" placeholder="Message" value={action.config.message || ''} onChange={e => updateActionConfig(i, 'message', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                      <select value={action.config.recipientRole || ''} onChange={e => updateActionConfig(i, 'recipientRole', e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">Recipient...</option>
                        <option value="ADMIN">Admins</option>
                        <option value="AGENT">Agents</option>
                        <option value="OWNER">Record Owner</option>
                      </select>
                    </>
                  )}
                  {action.type === 'UPDATE_FIELD' && (
                    <>
                      <select value={action.config.entityType || ''} onChange={e => updateActionConfig(i, 'entityType', e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                        <option value="">Entity...</option>
                        <option value="LEAD">Lead</option>
                        <option value="OPPORTUNITY">Opportunity</option>
                        <option value="CONTACT">Contact</option>
                        <option value="ACCOUNT">Account</option>
                      </select>
                      <input type="text" placeholder="Field name" value={action.config.field || ''} onChange={e => updateActionConfig(i, 'field', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                      <input type="text" placeholder="Value" value={action.config.value || ''} onChange={e => updateActionConfig(i, 'value', e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    </>
                  )}
                  {action.type === 'REASSIGN_OWNER' && (
                    <select value={action.config.reassignTo || ''} onChange={e => updateActionConfig(i, 'reassignTo', e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                      <option value="">Reassign to...</option>
                      <option value="manager">Owner's Manager</option>
                      <option value="specific">Specific User</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addAction} className="text-sm text-brand-600 hover:underline">+ Add Action</button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Review & Save</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Workflow Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" placeholder="e.g., New Lead Follow-up" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="What this workflow does..." />
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Trigger</div>
                <div className="text-sm font-medium">{TRIGGER_EVENTS.find(e => e.value === triggerEvent)?.label}</div>
              </div>
              {conditions.filter(c => c.field && c.value).length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Conditions</div>
                  {conditions.filter(c => c.field && c.value).map((c, i) => (
                    <div key={i} className="text-sm">{c.field} {CONDITION_OPERATORS.find(op => op.value === c.op)?.label} {c.value}</div>
                  ))}
                </div>
              )}
              <div className="border rounded-lg p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Actions</div>
                {actions.map((a, i) => (
                  <div key={i} className="text-sm mb-1">
                    <span className="font-medium">{ACTION_TYPES.find(at => at.value === a.type)?.label}</span>
                    {Object.entries(a.config).map(([k, v]) => (
                      <span key={k} className="text-gray-500 ml-1">• {k}: {v}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/crm/workflows')} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step < 4 && (
              <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                Next →
              </button>
            )}
            {step === 4 && (
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save & Activate'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrmWorkflowBuilder;
import React, { useEffect, useState } from 'react';
import ExecutiveChoice, { type ExecutiveSelection } from './ExecutiveChoice';
import { executiveLabel, hrExecutiveChoiceService, type EligibleExecutive } from '../../services/hrExecutiveChoice.service';
import type { Request } from './useRequestDetail';
import { friendlyMessage } from '../../utils/errorMessages';

interface Props {
  request: Request;
  currentUserId?: string;
  onSaved: () => Promise<void>;
}

export default function HrExecutiveChoiceCard({ request, currentUserId, onSaved }: Props) {
  const [selection, setSelection] = useState<ExecutiveSelection | null>(null);
  const [executives, setExecutives] = useState<EligibleExecutive[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const preRouting = ['SUBMITTED', 'IN_REVIEW'].includes(request.status)
    && !request.approvals?.some(approval => ['CEO', 'GROUP_DCEO'].includes(approval.approverType));
  const canChoose = preRouting && !request.executiveApproverId && currentUserId === request.requesterId;

  useEffect(() => {
    if (!request.executiveApproverId) return;
    let active = true;
    hrExecutiveChoiceService.list().then(users => { if (active) setExecutives(users); }).catch(() => {});
    return () => { active = false; };
  }, [request.executiveApproverId]);

  const save = async () => {
    if (!selection) { setError('Select an executive approver.'); return; }
    setSaving(true);
    setError('');
    try {
      await hrExecutiveChoiceService.save(request.id, { ...selection, version: request.version });
      await onSaved();
    } catch (err) {
      setError(friendlyMessage(err, 'Could not save the executive choice. Refresh the request and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const selectedPerson = executives.find(u => u.id === request.executiveApproverId && u.executiveApproverRole === request.executiveApproverRole);
  const savedName = request.executiveApprover && `${request.executiveApprover.firstName} ${request.executiveApprover.lastName}`;
  return <section aria-label="Executive approval choice" className="mb-6 p-5 bg-white rounded-xl border border-cwc-border space-y-3">
    <h2 className="font-bold text-lg">Executive approval</h2>
    {request.executiveApproverId ? (
      <p>Requester selected: <strong>{selectedPerson ? executiveLabel(selectedPerson) : `${savedName || 'Executive'} (${request.executiveApproverRole === 'CEO' ? 'CEO' : 'Group Deputy CEO'})`}</strong></p>
    ) : canChoose ? (
      <>
        <p className="text-sm text-text-secondary">Choose one executive before HR can route this request. The choice locks after routing.</p>
        <ExecutiveChoice value={selection} onChange={setSelection} disabled={saving} excludeUserId={currentUserId} />
        <button type="button" onClick={save} disabled={saving || !selection} className="px-4 py-2 bg-brand-700 text-white rounded-cwc-md disabled:opacity-50">{saving ? 'Saving…' : 'Save executive choice'}</button>
      </>
    ) : (
      <p className="text-sm text-amber-700">Waiting for requester to select an executive.</p>
    )}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}

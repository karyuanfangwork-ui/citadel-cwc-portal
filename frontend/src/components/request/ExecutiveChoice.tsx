import React, { useEffect, useState } from 'react';
import { executiveLabel, hrExecutiveChoiceService, type EligibleExecutive, type ExecutiveRole } from '../../services/hrExecutiveChoice.service';

export interface ExecutiveSelection {
  executiveApproverId: string;
  executiveApproverRole: ExecutiveRole;
}

interface Props {
  value?: ExecutiveSelection | null;
  onChange: (value: ExecutiveSelection | null) => void;
  disabled?: boolean;
  excludeUserId?: string;
}

export default function ExecutiveChoice({ value, onChange, disabled, excludeUserId }: Props) {
  const [options, setOptions] = useState<EligibleExecutive[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    hrExecutiveChoiceService.list()
      .then(users => { if (mounted) { const available = users.filter(u => u.id !== excludeUserId); setOptions(available); setError(available.length ? '' : 'No eligible executive is available. Contact your administrator.'); } })
      .catch(() => { if (mounted) setError('Could not load eligible executives. Please retry.'); });
    return () => { mounted = false; };
  }, [excludeUserId]);
  useEffect(() => {
    if (value && options.length > 0 && !options.some(u => u.id === value.executiveApproverId && u.executiveApproverRole === value.executiveApproverRole)) {
      onChange(null);
    }
  }, [options, value?.executiveApproverId, value?.executiveApproverRole]);

  return <div className="space-y-2">
    <label htmlFor="hr-executive-choice" className="block text-sm font-semibold">Executive approver <span aria-hidden="true">*</span></label>
    <select id="hr-executive-choice" required disabled={disabled || !!error} className="w-full px-4 py-3 border border-cwc-border rounded-cwc-md bg-white"
      value={value?.executiveApproverId && value?.executiveApproverRole ? `${value.executiveApproverRole}:${value.executiveApproverId}` : ''}
      onChange={event => {
        const option = options.find(u => `${u.executiveApproverRole}:${u.id}` === event.target.value);
        onChange(option ? { executiveApproverId: option.id, executiveApproverRole: option.executiveApproverRole } : null);
      }}>
      <option value="">Select CEO or Group Deputy CEO…</option>
      {options.map(person => <option key={`${person.executiveApproverRole}:${person.id}`} value={`${person.executiveApproverRole}:${person.id}`}>{executiveLabel(person)}</option>)}
    </select>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <p className="text-xs text-text-secondary">HR will route this request to the person you select.</p>
  </div>;
}

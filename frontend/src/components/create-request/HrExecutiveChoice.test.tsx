import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StepDetails from './StepDetails';
import StepReview from './StepReview';
import type { FormData } from './useCreateRequestWizard';
import { hrExecutiveChoiceService } from '../../services/hrExecutiveChoice.service';

vi.mock('../../services/hrExecutiveChoice.service', () => ({
  hrExecutiveChoiceService: { list: vi.fn().mockResolvedValue([{ id: 'ceo-1', firstName: 'Ada', lastName: 'Lovelace', executiveApproverRole: 'CEO' }]) },
  executiveLabel: (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName} (CEO)`,
}));

const formData = { summary: 'New hire', description: '', urgency: 'MEDIUM', customFields: {}, executiveApproverId: undefined, executiveApproverRole: undefined } as unknown as FormData;
const type = { code: 'NEW_HIRING', name: 'New Hiring', formConfig: [], requiresApproval: true };

it('shows the HR-only executive selector and records a named person', async () => {
  const setFormData = vi.fn();
  render(<StepDetails formData={formData} setFormData={setFormData} selectedRequestType={type} entityOptions={[]} ceoOptions={[]} uploadingFields={{}} setUploadingFields={vi.fn()} isRoleBlocked={false} deskType="hr" submitting={false} error={null} setError={vi.fn()} handleCustomFieldChange={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText(/executive approver/i), { target: { value: 'CEO:ceo-1' } });
  expect(setFormData).toHaveBeenCalled();
  expect(setFormData.mock.calls.at(-1)?.[0](formData)).toMatchObject({ executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO' });
});

it('shows the selected person on review', async () => {
  render(<StepReview formData={{ ...formData, executiveApproverId: 'ceo-1', executiveApproverRole: 'CEO' }} selectedRequestType={type} deskType="hr" entityOptions={[]} ceoOptions={[]} isRoleBlocked={false} />);
  await waitFor(() => expect(screen.getByText('Ada Lovelace (CEO)')).toBeInTheDocument());
});

it('does not offer the selector for another request type', () => {
  render(<StepDetails formData={formData} setFormData={vi.fn()} selectedRequestType={{ ...type, code: 'EMPLOYEE_ONBOARDING' }} entityOptions={[]} ceoOptions={[]} uploadingFields={{}} setUploadingFields={vi.fn()} isRoleBlocked={false} deskType="hr" submitting={false} error={null} setError={vi.fn()} handleCustomFieldChange={vi.fn()} />);
  expect(screen.queryByLabelText(/executive approver/i)).not.toBeInTheDocument();
});

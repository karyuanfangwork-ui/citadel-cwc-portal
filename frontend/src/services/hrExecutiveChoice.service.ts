import apiClient from './api';

export type ExecutiveRole = 'CEO' | 'GROUP_DCEO';
export interface EligibleExecutive {
  id: string;
  firstName: string;
  lastName: string;
  executiveApproverRole: ExecutiveRole;
}

export const hrExecutiveChoiceService = {
  async list(): Promise<EligibleExecutive[]> {
    const response = await apiClient.get('/users/eligible-executives');
    return response.data.data.executives;
  },
  async save(requestId: string, choice: { executiveApproverId: string; executiveApproverRole: ExecutiveRole; version: number }) {
    const response = await apiClient.put(`/requests/${requestId}/executive-approver-choice`, choice);
    return response.data.data.request;
  },
};

export const executiveLabel = (person: EligibleExecutive) =>
  `${person.firstName} ${person.lastName} (${person.executiveApproverRole === 'CEO' ? 'CEO' : 'Group Deputy CEO'})`;

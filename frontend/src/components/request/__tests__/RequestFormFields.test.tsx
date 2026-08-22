import { render, screen } from '@testing-library/react';
import RequestFormFields from '../RequestFormFields';

vi.mock('@/src/components/request-detail/CustomFieldsPanel', () => ({
  default: () => null,
}));

vi.mock('@/src/components/request-detail/AssignAgentModal', () => ({
  default: () => null,
}));

const request = {
  id: 'request-1',
  summary: 'Purchase: Miscellaneous',
  description: 'Purchase requisition details',
  status: 'IN_PROGRESS',
  createdAt: '2026-08-17T14:31:00.000Z',
  updatedAt: '2026-08-17T14:31:00.000Z',
  serviceDesk: { code: 'FINANCE', name: 'Group Finance' },
  requestType: { name: 'Purchase Requisition' },
  requester: {
    id: 'user-1',
    firstName: 'Girlina',
    lastName: 'Liong',
    email: 'girlina@example.com',
  },
};

describe('RequestFormFields', () => {
  it('renders Description with the same card treatment as request metadata', () => {
    render(
      <RequestFormFields
        request={request}
        activities={[]}
      />,
    );

    const descriptionLabel = screen.getByText('Description');
    const descriptionCard = descriptionLabel.parentElement;
    const metadataCard = screen.getByText('Status').closest('div.grid');

    expect(descriptionCard).toHaveClass(
      'bg-white',
      'border-gray-100',
      'rounded-xl',
      'shadow-sm',
    );
    expect(descriptionCard).toHaveClass('p-5');
    expect(metadataCard).toHaveClass(
      'bg-white',
      'border-gray-100',
      'rounded-xl',
      'shadow-sm',
    );
  });
});

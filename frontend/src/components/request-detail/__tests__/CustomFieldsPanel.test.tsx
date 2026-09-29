import { render, screen } from '@testing-library/react';
import CustomFieldsPanel from '../CustomFieldsPanel';

vi.mock('../../../services/entity.service', () => ({
  entityService: { listActiveEntities: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const approverId = '03e2bac8-c435-40b0-bd81-cfd010c131dc';
const formConfig = [{ id: 'field_ceo', type: 'ceo-select', label: 'Approver', required: true }];

describe('CustomFieldsPanel CEO approver display', () => {
  it('renders the selected approver name and role instead of the stored UUID', async () => {
    render(
      <CustomFieldsPanel
        customFields={{ field_ceo: approverId }}
        serviceDeskCode="FINANCE"
        formConfig={formConfig}
        customFieldDisplay={{ field_ceo: 'Emily Chow — CEO (inactive)' }}
      />,
    );

    expect(await screen.findByText('Emily Chow — CEO (inactive)')).toBeInTheDocument();
    expect(screen.queryByText(approverId)).not.toBeInTheDocument();
  });

  it('does not expose the raw UUID when the selected approver is unavailable', () => {
    render(
      <CustomFieldsPanel
        customFields={{ field_ceo: approverId }}
        serviceDeskCode="FINANCE"
        formConfig={formConfig}
        customFieldDisplay={{ field_ceo: 'Unavailable approver' }}
      />,
    );

    expect(screen.getByText('Unavailable approver')).toBeInTheDocument();
    expect(screen.queryByText(approverId)).not.toBeInTheDocument();
  });
});

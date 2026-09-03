import { fireEvent, render, screen } from '@testing-library/react';
import StatusPalette from './StatusPalette';

const definition = (code: string) => ({
  id: code,
  code,
  label: code === 'IN_PROGRESS' ? 'In progress' : 'CEO approval',
  description: null,
  category: 'FINANCE',
  displayOrder: 0,
  isActive: true,
  lifecycleType: 'OPEN' as const,
  retiredAt: null,
  createdAt: '',
  updatedAt: '',
});

describe('StatusPalette', () => {
  it('shows governed statuses with explicit graph membership', () => {
    render(<StatusPalette definitions={[definition('IN_PROGRESS'), definition('PENDING_CEO_APPROVAL_FIN')]} loading={false} error={null} existingCodes={new Set(['IN_PROGRESS'])} readOnly={false} onAdd={() => undefined} />);
    expect(screen.getByText('In this draft')).toBeInTheDocument();
    expect(screen.getByText('Catalogue only — add to draft')).toBeInTheDocument();
    expect(screen.getByText('Governed statuses')).toBeInTheDocument();
  });

  it('does not offer an existing status for re-adding', () => {
    render(<StatusPalette definitions={[definition('IN_PROGRESS'), definition('PENDING_CEO_APPROVAL_FIN')]} loading={false} error={null} existingCodes={new Set(['IN_PROGRESS'])} readOnly={false} onAdd={() => undefined} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Status code' }), { target: { value: 'PENDING_CEO_APPROVAL_FIN' } });
    expect(screen.getByRole('button', { name: 'Add status' })).toBeEnabled();
  });
});

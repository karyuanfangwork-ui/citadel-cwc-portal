import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusPalette from '../StatusPalette';
import type { RequestStatusDefinition } from '../../../services/requestStatusService';

const definition: RequestStatusDefinition = {
  id: 'status-1',
  code: 'FINANCE_REVIEW',
  label: 'Finance Review',
  description: 'Finance review is pending',
  category: 'FINANCE',
  displayOrder: 1,
  isActive: true,
  lifecycleType: 'OPEN',
  retiredAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('StatusPalette', () => {
  it('creates a status node from a governed definition', () => {
    const onAdd = vi.fn();
    render(<StatusPalette definitions={[definition]} loading={false} error={null} existingCodes={new Set()} readOnly={false} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('Status code'), { target: { value: 'FINANCE_REVIEW' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add status' }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      statusCode: 'FINANCE_REVIEW',
      label: 'Finance Review',
    }));
  });

  it('does not offer a status already present in the graph', () => {
    render(<StatusPalette definitions={[definition]} loading={false} error={null} existingCodes={new Set(['FINANCE_REVIEW'])} readOnly={false} onAdd={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Select a status…' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /FINANCE_REVIEW/ })).not.toBeInTheDocument();
  });
});

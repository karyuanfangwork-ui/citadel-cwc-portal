import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusPalette from '../StatusPalette';

describe('StatusPalette', () => {
  it('creates a status node with a raw UUID accepted by the API', () => {
    const onAdd = vi.fn();
    render(<StatusPalette existingCodes={new Set()} readOnly={false} onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText('New status code'), { target: { value: 'finance_review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add status' }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      statusCode: 'FINANCE_REVIEW',
    }));
  });
});

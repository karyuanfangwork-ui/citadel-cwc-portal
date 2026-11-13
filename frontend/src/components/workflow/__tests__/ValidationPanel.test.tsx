import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ValidationPanel from '../ValidationPanel';

const warning = { code: 'UNKNOWN_TRANSITION_LABEL', message: 'SUBMITTED → CANCELLED uses legacy label CANCEL' };
const blocking = { code: 'MISSING_FINAL', message: 'Workflow needs an ending status' };

describe('ValidationPanel', () => {
  it('keeps warning details collapsed by default while showing counts', () => {
    render(<ValidationPanel blocking={[]} warnings={[warning]} onFocus={vi.fn()} />);
    expect(screen.getByText('1 warnings')).toBeInTheDocument();
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show warnings' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('allows warning details to expand and collapse without hiding blocking findings', async () => {
    const onFocus = vi.fn();
    render(<ValidationPanel blocking={[blocking]} warnings={[warning]} onFocus={onFocus} />);
    expect(screen.getByText(blocking.message)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show warnings' }));
    expect(screen.getByText(warning.message)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide warnings' }));
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    expect(screen.getByText(blocking.message)).toBeInTheDocument();
  });
});

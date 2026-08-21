import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AssignmentStep from '../AssignmentStep';

describe('AssignmentStep', () => {
  it('shows resolved staff and branch names without raw IDs', () => {
    render(<AssignmentStep lane="SME" laneReason="Sole proprietor borrower" rm={{ id: 'rm-1', firstName: 'Aisha', lastName: 'Rahman', email: 'aisha@example.test' }} analyst={{ id: 'an-1', firstName: 'Daniel', lastName: 'Lim', email: 'daniel@example.test' }} branch={{ id: 'br-1', code: 'KL', name: 'Kuala Lumpur', region: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }} canOverride={false} />);
    expect(screen.getByText('Aisha Rahman')).toBeInTheDocument();
    expect(screen.getByText('Daniel Lim')).toBeInTheDocument();
    expect(screen.getByText('KL — Kuala Lumpur')).toBeInTheDocument();
    expect(screen.queryByText('rm-1')).not.toBeInTheDocument();
    expect(screen.queryByText('an-1')).not.toBeInTheDocument();
  });

  it('only exposes override action when permitted', () => {
    const onOverride = vi.fn();
    const { rerender } = render(<AssignmentStep lane="SME" canOverride={false} onOverride={onOverride} />);
    expect(screen.queryByRole('button', { name: /override/i })).not.toBeInTheDocument();
    rerender(<AssignmentStep lane="SME" canOverride onOverride={onOverride} />);
    expect(screen.getByRole('button', { name: /override/i })).toBeInTheDocument();
  });
});

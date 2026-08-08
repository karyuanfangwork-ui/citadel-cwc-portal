import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SLAIndicator from '../SLAIndicator';

describe('SLAIndicator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clearly identifies a paused SLA from slaPausedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T08:00:00.000Z'));

    render(
      <SLAIndicator
        slaDueAt="2026-08-08T07:00:00.000Z"
        status="IN_REVIEW"
        slaPausedAt="2026-08-07T07:00:00.000Z"
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'SLA paused. Timer stopped for the current workflow status.',
    );
    expect(screen.getByText('SLA PAUSED')).toBeInTheDocument();
    expect(screen.getByText(/Timer stopped/)).toBeInTheDocument();
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('shows the active countdown when the SLA is not paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T08:00:00.000Z'));

    render(
      <SLAIndicator
        slaDueAt="2026-08-08T07:00:00.000Z"
        status="IN_REVIEW"
      />,
    );

    expect(screen.getByText(/SLA: 23h remaining/)).toBeInTheDocument();
    expect(screen.queryByText('SLA PAUSED')).not.toBeInTheDocument();
  });
});

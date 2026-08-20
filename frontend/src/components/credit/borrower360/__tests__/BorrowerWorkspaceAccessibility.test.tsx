import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BorrowerReadinessStrip from '../BorrowerReadinessStrip';

describe('Borrower workspace accessibility', () => {
  it('exposes readiness status, live updates, and progress semantics', () => {
    render(<BorrowerReadinessStrip readiness={{ status: 'BLOCKED', completionPct: 40, outstandingCount: 3, actions: [{ id: 'bureau', severity: 'WARNING', title: 'Refresh bureau report', description: 'The report is stale.', actionLabel: 'Upload bureau report', target: 'bureau' }] }} onAction={vi.fn()} />);
    expect(screen.getByText('Not ready')).toBeVisible();
    expect(screen.getByText(/3 items need attention/i)).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Readiness completion' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('button', { name: 'Upload bureau report' })).toBeVisible();
  });

  it('keeps a ready state understandable without relying on color', () => {
    render(<BorrowerReadinessStrip readiness={{ status: 'READY', completionPct: 100, outstandingCount: 0, actions: [] }} onAction={vi.fn()} />);
    expect(screen.getByText('Ready')).toBeVisible();
    expect(screen.getByText('All required checks are complete')).toBeVisible();
  });
});

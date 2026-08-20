import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RmLane from '../RmLane';
import type { MyWorkItem } from '../../../../services/credit.service';

const item = (over: Partial<MyWorkItem> = {}): MyWorkItem => ({
  id: 'app-1', applicationNo: 'CA-2026-00016', state: 'UNDERWRITING', borrowerName: 'Lyra Manufacturing Sdn Bhd',
  productType: 'TERM_LOAN', updatedAt: '2026-08-19T00:00:00Z', requestedAmount: 7000000, riskGrade: 'BB',
  slaStatus: 'OK', entityType: 'CORPORATE', slaRemainingHours: 40, priority: 'MEDIUM', blocker: 'Complete underwriting',
  currentTask: 'Complete underwriting', nextAction: { label: 'Continue underwriting', route: '/credit/applications/app-1' }, ...over,
});

const renderLane = (items: MyWorkItem[]) => render(<MemoryRouter><RmLane items={items} formatAmount={v => `RM ${v?.toLocaleString() ?? '—'}`} /></MemoryRouter>);

describe('RmLane', () => {
  it('leads rows with the blocker and one primary action', () => {
    renderLane([item({ state: 'REFERRED_BACK', blocker: 'Returned by credit — 2 conditions outstanding', priority: 'HIGH', nextAction: { label: 'Review returned items', route: '/credit/applications/app-1' } })]);
    const row = screen.getByRole('listitem', { name: /CA-2026-00016/ });
    expect(within(row).getByText('Returned by credit — 2 conditions outstanding')).toBeInTheDocument();
    expect(within(row).getAllByRole('link')).toHaveLength(1);
  });

  it('shows the SLA countdown and overdue state', () => {
    renderLane([item({ slaStatus: 'WARNING', slaRemainingHours: 4 })]);
    expect(screen.getByText('4h left')).toBeInTheDocument();
    renderLane([item({ id: 'app-2', applicationNo: 'CA-2', slaStatus: 'OVERDUE', slaRemainingHours: 0 })]);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('orders needs-you rows by priority and keeps drafts separate', () => {
    renderLane([item({ id: 'low', applicationNo: 'CA-LOW', state: 'REFERRED_BACK', priority: 'LOW' }), item({ id: 'high', applicationNo: 'CA-HIGH', state: 'REFERRED_BACK', priority: 'HIGH' }), item({ id: 'draft', applicationNo: 'CA-DRAFT', state: 'DRAFT' })]);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveAccessibleName(expect.stringContaining('CA-HIGH'));
    expect(screen.getByRole('region', { name: 'Drafts' })).toHaveTextContent('CA-DRAFT');
  });

  it('groups in-flight work by holder', () => {
    renderLane([item({ id: 'credit', applicationNo: 'CA-X', state: 'KYC_REVIEW' }), item({ id: 'committee', applicationNo: 'CA-Y', state: 'COMMITTEE_REVIEW' })]);
    const inFlight = screen.getByRole('region', { name: 'In flight' });
    expect(within(inFlight).getByRole('heading', { name: 'With credit' })).toBeInTheDocument();
    expect(within(inFlight).getByRole('heading', { name: 'With committee' })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkflowListCard from '../WorkflowListCard';
import type { RequestTypeSummary, WorkflowSummary } from '../../../services/workflow-version.service';

const types = (...names: string[]): RequestTypeSummary[] =>
  names.map((name, index) => ({ id: `rt-${index}`, name }));

const workflow = (requestTypes: RequestTypeSummary[]): WorkflowSummary => ({
  id: 'wt-1',
  code: 'IT_PROCUREMENT',
  name: 'IT Procurement',
  requestTypes,
  activeVersion: { id: 'v-1', version: 1, status: 'ACTIVE', publishedAt: null },
  draftVersion: null,
});

const renderCard = (requestTypes: RequestTypeSummary[]) =>
  render(
    <MemoryRouter>
      <WorkflowListCard workflow={workflow(requestTypes)} onCreateDraft={vi.fn()} />
    </MemoryRouter>,
  );

describe('WorkflowListCard', () => {
  it('names each bound request type instead of only counting them', () => {
    renderCard(types('Purchase Requisition', 'Hardware Request'));
    expect(screen.getByText('Purchase Requisition')).toBeInTheDocument();
    expect(screen.getByText('Hardware Request')).toBeInTheDocument();
    expect(screen.queryByText(/affects/)).not.toBeInTheDocument();
  });

  it('collapses more than three request types into a titled overflow pill', () => {
    renderCard(types('One', 'Two', 'Three', 'Four', 'Five'));
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.queryByText('Four')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toHaveAttribute('title', 'Four, Five');
  });

  it('flags a workflow that is bound to nothing', () => {
    renderCard([]);
    expect(screen.getByText('Not bound to any request type')).toBeInTheDocument();
  });
});
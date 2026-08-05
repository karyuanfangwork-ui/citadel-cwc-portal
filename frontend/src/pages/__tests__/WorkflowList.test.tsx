import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  listWorkflows: vi.fn(),
  createDraft: vi.fn(),
}));
vi.mock('../../services/workflow-version.service', () => ({ default: service }));
import WorkflowList from '../../../pages/WorkflowList';

const workflow = { id: 'wt-1', code: 'IT_SIMPLE', name: 'IT Simple', requestTypes: [{ id: 'rt-1', name: 'Hardware' }, { id: 'rt-2', name: 'Access' }], activeVersion: { id: 'v-1', version: 1, status: 'ACTIVE' as const, publishedAt: null }, draftVersion: null };

describe('WorkflowList', () => {
  beforeEach(() => { vi.clearAllMocks(); service.listWorkflows.mockResolvedValue({ workflows: [workflow] }); });

  it('shows workflow impact and active version', async () => {
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    expect(await screen.findByText('IT Simple')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('Active v1')).toBeInTheDocument();
  });

  it('creates a draft only after confirmation', async () => {
    const user = userEvent.setup();
    service.createDraft.mockResolvedValue({ draft: { id: 'v-2', version: 2 } });
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Create draft' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create draft' })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(service.createDraft).toHaveBeenCalledWith('wt-1'));
  });
});

const procurement = { id: 'wt-2', code: 'IT_PROCUREMENT', name: 'IT Procurement', requestTypes: [{ id: 'rt-9', name: 'Purchase Requisition' }], activeVersion: { id: 'v-9', version: 1, status: 'ACTIVE' as const, publishedAt: null }, draftVersion: null };

describe('WorkflowList search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listWorkflows.mockResolvedValue({ workflows: [workflow, procurement] });
  });

  const search = () => screen.getByRole('searchbox', { name: 'Search workflows or request types' });

  it('filters by request type name', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    expect(await screen.findByText('IT Simple')).toBeInTheDocument();
    await user.type(search(), 'purchase');
    expect(screen.getByText('IT Procurement')).toBeInTheDocument();
    expect(screen.queryByText('IT Simple')).not.toBeInTheDocument();
  });

  it('filters by workflow code', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    await user.type(await screen.findByRole('searchbox', { name: 'Search workflows or request types' }), 'IT_SIMPLE');
    expect(screen.getByText('IT Simple')).toBeInTheDocument();
    expect(screen.queryByText('IT Procurement')).not.toBeInTheDocument();
  });

  it('offers a distinct empty state that clears the query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><WorkflowList /></MemoryRouter>);
    await user.type(await screen.findByRole('searchbox', { name: 'Search workflows or request types' }), 'nothing matches this');
    expect(screen.getByText('No workflows match "nothing matches this"')).toBeInTheDocument();
    expect(screen.queryByText('No active workflows')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('IT Simple')).toBeInTheDocument();
    expect(search()).toHaveValue('');
  });
});

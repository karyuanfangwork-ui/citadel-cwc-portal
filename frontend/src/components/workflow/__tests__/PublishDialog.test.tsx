import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublishDialog from '../PublishDialog';
import type { GraphNode, RemapPlan, WorkflowSummary, WorkflowVersionSummary } from '../../../services/workflow-version.service';

const workflow: WorkflowSummary = {
  id: 'wf1', code: 'IT', name: 'IT Support',
  requestTypes: [{ id: 'rt1', name: 'Get IT Help' }],
  activeVersion: null, draftVersion: null,
};
const version: WorkflowVersionSummary = { id: 'v4', version: 4, status: 'DRAFT', publishedAt: null };

const node = (statusCode: string, slaPause = false): GraphNode => ({
  id: statusCode, type: 'STATUS', statusCode, positionX: 0, positionY: 0,
  isInitial: false, isFinal: false, slaPause, icon: 'radio_button_checked',
});

const plan: RemapPlan = {
  totalRequests: 2,
  entries: [
    { statusCode: 'ACTION_REQUIRED', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows ACTION_REQUIRED → IN_PROGRESS', allowedTargets: ['IN_PROGRESS', 'WAITING'], sourcePausesSla: true },
    { statusCode: 'IN_REVIEW', requestCount: 1, suggestedTarget: 'IN_PROGRESS', suggestionReason: 'v3 allows IN_REVIEW → IN_PROGRESS', allowedTargets: ['IN_PROGRESS', 'WAITING'], sourcePausesSla: false },
  ],
};

const renderDialog = (over: Partial<React.ComponentProps<typeof PublishDialog>> = {}) => {
  const onConfirm = vi.fn();
  render(
    <PublishDialog
      workflow={workflow}
      version={version}
      blocking={[]}
      warnings={[]}
      remapPlan={null}
      nodes={[node('IN_PROGRESS'), node('WAITING', true)]}
      busy={false}
      onConfirm={onConfirm}
      onClose={vi.fn()}
      {...over}
    />,
  );
  return { onConfirm };
};

describe('PublishDialog', () => {
  it('skips the remap step when nothing is stranded', async () => {
    const { onConfirm } = renderDialog();
    expect(screen.queryByText(/Step 1 of 2/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Publish version/ }));
    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it('shows one row per stranded status with its request count', () => {
    renderDialog({ remapPlan: plan });
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('ACTION_REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('IN_REVIEW')).toBeInTheDocument();
    expect(screen.getAllByText(/1 request/)).toHaveLength(2);
  });

  it('prefills each dropdown with the suggested target and explains why', () => {
    renderDialog({ remapPlan: plan });
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('IN_PROGRESS');
    expect(screen.getByText(/v3 allows ACTION_REQUIRED → IN_PROGRESS/)).toBeInTheDocument();
  });

  it('warns when the source pauses SLA but the target does not', () => {
    renderDialog({ remapPlan: plan });
    expect(screen.getByText(/ACTION_REQUIRED pauses SLA, IN_PROGRESS does not/)).toBeInTheDocument();
  });

  it('confirms with the chosen mapping after both steps', async () => {
    const { onConfirm } = renderDialog({ remapPlan: plan });
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'WAITING');
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(screen.getByLabelText(/2 requests will be moved/));
    await userEvent.click(screen.getByRole('button', { name: /Publish version/ }));
    expect(onConfirm).toHaveBeenCalledWith({ ACTION_REQUIRED: 'IN_PROGRESS', IN_REVIEW: 'WAITING' });
  });

  it('disables Continue until every stranded status has a target', async () => {
    const unsuggested: RemapPlan = {
      totalRequests: 1,
      entries: [{ statusCode: 'ORPHAN', requestCount: 1, suggestedTarget: null, suggestionReason: 'No surviving status is reachable — choose a target manually', allowedTargets: ['IN_PROGRESS'], sourcePausesSla: false }],
    };
    renderDialog({ remapPlan: unsuggested });
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'IN_PROGRESS');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  it('keeps Publish disabled while unresolved blocking findings remain', () => {
    renderDialog({ blocking: [{ code: 'MISSING_FINAL', message: 'no final node' }] });
    expect(screen.getByRole('button', { name: /Publish version/ })).toBeDisabled();
  });
});
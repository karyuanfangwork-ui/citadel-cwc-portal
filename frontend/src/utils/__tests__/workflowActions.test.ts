import { describe, expect, it } from 'vitest';
import {
  filterActionsByDesignerTargets,
  type WorkflowAction,
} from '../workflowActions';

describe('filterActionsByDesignerTargets', () => {
  const actions: WorkflowAction[] = [
    {
      type: 'MARK_IN_PROGRESS',
      label: 'Mark In Progress',
      description: 'Start actively working on this request.',
      variant: 'primary',
    },
    {
      type: 'RESOLVE_IT',
      label: 'Resolve Ticket',
      description: 'Mark this request as resolved and close it.',
      variant: 'success',
    },
  ];

  it('hides legacy Mark In Progress when the published designer graph has no IN_PROGRESS target', () => {
    const result = filterActionsByDesignerTargets(actions, new Set(['RESOLVED', 'WAITING']));

    expect(result.map((action) => action.type)).toEqual(['RESOLVE_IT']);
  });

  it('keeps specialized actions whose target exists in the published designer graph', () => {
    const result = filterActionsByDesignerTargets(actions, new Set(['IN_PROGRESS', 'RESOLVED']));

    expect(result.map((action) => action.type)).toEqual(['MARK_IN_PROGRESS', 'RESOLVE_IT']);
  });
});

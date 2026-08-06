import { planCanonicalBootstrap } from '../workflowBootstrap.service';

const step = (status: string, overrides: Partial<{
  label: string;
  isInitial: boolean;
  isFinal: boolean;
}> = {}) => ({
  status,
  label: overrides.label ?? status,
  icon: 'radio_button_checked',
  displayOrder: 1,
  isInitial: overrides.isInitial ?? false,
  isFinal: overrides.isFinal ?? false,
  slaPause: false,
});

describe('planCanonicalBootstrap', () => {
  it('fails closed when a candidate edge has no runtime policy', () => {
    const plan = planCanonicalBootstrap({
      workflowCode: 'TEST',
      current: { nodes: [], edges: [] },
      steps: [
        step('SUBMITTED', { isInitial: true }),
        step('RESOLVED', { isFinal: true }),
      ],
      definitions: [{
        fromStatus: 'SUBMITTED',
        toStatus: 'RESOLVED',
        transitionLabel: 'RESOLVE',
        requiresComment: false,
      }],
      globalPolicies: [],
      occupiedStatuses: ['SUBMITTED'],
    });

    expect(plan.graph.edges).toHaveLength(1);
    expect(plan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_RUNTIME_POLICY', severity: 'BLOCKING' }),
    ]));
  });

  it('preserves global runtime authorization metadata on candidate edges', () => {
    const plan = planCanonicalBootstrap({
      workflowCode: 'TEST',
      current: { nodes: [], edges: [] },
      steps: [
        step('SUBMITTED', { isInitial: true }),
        step('RESOLVED', { isFinal: true }),
      ],
      definitions: [{
        fromStatus: 'SUBMITTED',
        toStatus: 'RESOLVED',
        transitionLabel: 'RESOLVE',
        requiresComment: false,
      }],
      globalPolicies: [{
        fromStatus: 'SUBMITTED',
        toStatus: 'RESOLVED',
        transitionLabel: 'RESOLVE',
        requiresComment: true,
        autoAssignRole: 'AGENT',
        autoAssignUserId: null,
        allowedRoles: ['AGENT'],
        allowedExecutiveRoles: ['CEO'],
        isActive: true,
      }],
      occupiedStatuses: [],
    });

    expect(plan.graph.edges[0]).toMatchObject({
      requiresComment: true,
      autoAssignRole: 'AGENT',
      allowedRoles: ['AGENT'],
      allowedExecutiveRoles: ['CEO'],
    });
    expect(plan.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_RUNTIME_POLICY' }),
    ]));
  });

  it('blocks synthetic sequential edges and occupied statuses without exits', () => {
    const plan = planCanonicalBootstrap({
      workflowCode: 'TEST',
      current: { nodes: [], edges: [] },
      steps: [
        step('SUBMITTED', { isInitial: true }),
        step('IN_REVIEW'),
      ],
      definitions: [],
      globalPolicies: [],
      occupiedStatuses: ['IN_REVIEW'],
    });

    expect(plan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SYNTHETIC_SEQUENTIAL_EDGE', severity: 'BLOCKING' }),
      expect.objectContaining({ code: 'OCCUPIED_STATUS_NO_EXIT', severity: 'BLOCKING' }),
    ]));
  });

  it('blocks a live status that is absent from the canonical workflow', () => {
    const plan = planCanonicalBootstrap({
      workflowCode: 'TEST',
      current: { nodes: [], edges: [] },
      steps: [step('SUBMITTED', { isInitial: true }), step('RESOLVED', { isFinal: true })],
      definitions: [],
      globalPolicies: [],
      occupiedStatuses: ['LEGACY_STATUS'],
    });

    expect(plan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OCCUPIED_STATUS_NOT_CANONICAL', status: 'LEGACY_STATUS' }),
    ]));
  });

  it('applies the approved IT_SIMPLE cancellation policy', () => {
    const plan = planCanonicalBootstrap({
      workflowCode: 'IT_SIMPLE',
      current: { nodes: [], edges: [] },
      steps: [
        step('SUBMITTED', { isInitial: true }),
      ],
      definitions: [],
      globalPolicies: [],
      occupiedStatuses: ['CANCELLED'],
    });

    const cancellationEdges = plan.graph.edges.filter((edge) => edge.requiresComment);
    expect(cancellationEdges).toHaveLength(1);
    expect(cancellationEdges[0]).toMatchObject({
      allowedRoles: ['AGENT', 'ADMIN'],
      requiresComment: true,
    });
    expect(plan.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SYNTHETIC_CANCEL_EDGE', severity: 'BLOCKING' }),
    ]));
  });
});

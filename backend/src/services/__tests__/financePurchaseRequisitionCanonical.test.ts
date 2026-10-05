import {
  buildCanonicalFinancePurchaseRequisitionGraph,
  compareFinanceVersion,
  FINANCE_CANONICAL_FINGERPRINT,
  fingerprintGraph,
} from '../../scripts/financePurchaseRequisitionCanonical';

const versionFrom = (graph: ReturnType<typeof buildCanonicalFinancePurchaseRequisitionGraph>, overrides: Record<string, unknown> = {}) => ({
  id: 'version-1',
  version: 8,
  status: 'DRAFT',
  nodes: graph.nodes,
  edges: graph.edges,
  ...overrides,
});

describe('Finance Purchase Requisition canonical graph', () => {
  it('contains the approved CEO → CFO → Group DCEO payment and closure path', () => {
    const graph = buildCanonicalFinancePurchaseRequisitionGraph();
    const byId = new Map(graph.nodes.map((node) => [node.id, node.statusCode]));
    const pairs = graph.edges.map((edge) => `${byId.get(edge.fromNodeId)}→${byId.get(edge.toNodeId)}`);

    expect(graph.approvalOrder).toEqual(['CEO', 'CFO', 'GROUP_DCEO']);
    expect(pairs).toEqual(expect.arrayContaining([
      'FINANCE_ACKNOWLEDGED→PENDING_CEO_APPROVAL_FIN',
      'PENDING_CEO_APPROVAL_FIN→PENDING_CFO_APPROVAL_FIN',
      'PENDING_CFO_APPROVAL_FIN→CFO_APPROVED_FIN',
      'CFO_APPROVED_FIN→PENDING_GROUP_DCEO_APPROVAL',
      'GROUP_DCEO_APPROVED→PAYMENT_PROCESSING_FIN',
      'PAYMENT_PROCESSING_FIN→AWAITING_PAYMENT_CONFIRMATION',
      'AWAITING_PAYMENT_CONFIRMATION→PAYMENT_CONFIRMED_FIN',
      'PAYMENT_CONFIRMED_FIN→TICKET_CLOSED_FIN',
      'PENDING_CEO_APPROVAL_FIN→CEO_REJECTED_FIN',
      'PENDING_CFO_APPROVAL_FIN→CFO_REJECTED_FIN',
      'PENDING_GROUP_DCEO_APPROVAL→GROUP_DCEO_REJECTED',
      'FINANCE_ACKNOWLEDGED→CANCELLED',
    ]));
  });

  it('allows the requester-selected Group DCEO to act at the CEO gate while preserving exact-approver checks', () => {
    const graph = buildCanonicalFinancePurchaseRequisitionGraph();
    const byId = new Map(graph.nodes.map((node) => [node.id, node.statusCode]));
    const approvalEdges = graph.edges.filter((edge) =>
      byId.get(edge.fromNodeId) === 'PENDING_CEO_APPROVAL_FIN'
      || byId.get(edge.fromNodeId) === 'CEO_APPROVED_FIN',
    );

    expect(approvalEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        transitionLabel: 'APPROVE',
        allowedExecutiveRoles: ['CEO', 'GROUP_DCEO'],
      }),
      expect.objectContaining({
        transitionLabel: 'REJECT',
        allowedExecutiveRoles: ['CEO', 'GROUP_DCEO'],
        requiresComment: true,
      }),
    ]));
    expect(approvalEdges.every((edge) => edge.allowedExecutiveRoles.includes('GROUP_DCEO'))).toBe(true);
  });

  it('produces a stable hash and counts independent of array order and node ids', () => {
    const graph = buildCanonicalFinancePurchaseRequisitionGraph();
    const reordered = {
      ...graph,
      nodes: [...graph.nodes].reverse().map((node) => ({ ...node, id: `other-${node.statusCode}` })),
      edges: [...graph.edges].reverse().map((edge) => ({
        ...edge,
        fromNodeId: `other-${graph.nodes.find((node) => node.id === edge.fromNodeId)?.statusCode}`,
        toNodeId: `other-${graph.nodes.find((node) => node.id === edge.toNodeId)?.statusCode}`,
      })),
    };

    expect(fingerprintGraph(reordered)).toEqual(FINANCE_CANONICAL_FINGERPRINT);
  });

  it('reports duplicate outgoing labels in active/draft comparison', () => {
    const graph = buildCanonicalFinancePurchaseRequisitionGraph();
    const cfo = graph.nodes.find((node) => node.statusCode === 'CFO_APPROVED_FIN')!;
    const dceo = graph.nodes.find((node) => node.statusCode === 'PENDING_GROUP_DCEO_APPROVAL')!;
    const duplicate = { ...graph.edges.find((edge) => edge.fromNodeId === cfo.id)!, id: 'duplicate', toNodeId: dceo.id, transitionLabel: 'ADVANCE' };
    const existingAsAdvance = graph.edges.map((edge) => edge.fromNodeId === cfo.id ? { ...edge, transitionLabel: 'ADVANCE' } : edge);
    const comparison = compareFinanceVersion(versionFrom(graph, { edges: [...existingAsAdvance, duplicate] }));

    expect(comparison.duplicateOutgoingLabels).toEqual([
      { fromStatus: 'CFO_APPROVED_FIN', label: 'ADVANCE', edgeCount: 2 },
    ]);
  });
});

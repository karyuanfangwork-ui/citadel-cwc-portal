import financeWorkflowRouter from '../finance-workflow.routes';

describe('Finance Purchase Requisition CEO decision route authorization', () => {
  const routeLayer = (financeWorkflowRouter as any).stack.find(
    (layer: any) => layer.route?.path === '/requests/:id/ceo-decision',
  );
  const authorizeHandler = routeLayer?.route?.stack[0]?.handle;

  it('allows a GROUP_DCEO through the route role gate', () => {
    const next = jest.fn();
    authorizeHandler({ user: { roles: ['NORMAL_STAFF', 'GROUP_DCEO'] } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('does not allow an unrelated role through the route role gate', () => {
    const next = jest.fn();
    authorizeHandler({ user: { roles: ['NORMAL_STAFF'] } }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

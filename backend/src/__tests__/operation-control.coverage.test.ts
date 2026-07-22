import { extractAllRoutes, normalizePath } from '../../scripts/verify-operation-controls';
import { operationControls } from '../security/operation-control.registry';

const routeKey = (method: string, path: string): string =>
  `${method} ${normalizePath(path)}`;

describe('Operation control route coverage', () => {
  it('has exact bidirectional parity with the live Express route inventory', () => {
    const routeKeys = extractAllRoutes().map((route) => routeKey(route.method, route.path));
    const controlKeys = operationControls.map((control) => routeKey(control.method, control.path));

    expect(new Set(routeKeys).size).toBe(routeKeys.length);
    expect(new Set(controlKeys).size).toBe(controlKeys.length);
    expect([...controlKeys].sort()).toEqual([...routeKeys].sort());
  });

  it('does not treat commented-out route declarations as live operations', () => {
    const routeKeys = new Set(
      extractAllRoutes().map((route) => routeKey(route.method, route.path)),
    );

    expect(routeKeys.has('POST /auth/register')).toBe(false);
  });
});

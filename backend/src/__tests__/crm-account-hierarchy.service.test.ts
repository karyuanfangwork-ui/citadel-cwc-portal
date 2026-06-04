import { detectCycle, type HierarchyDeps } from '../services/crm-account-hierarchy.service';

// Mock deps — walk the parent chain in-memory
function makeDeps(chain: Map<string, string | null>): HierarchyDeps {
  return {
    getParentId: async (id: string) => chain.get(id) ?? null,
  };
}

describe('detectCycle', () => {
  it('returns ok when no parent is set', async () => {
    const deps = makeDeps(new Map([['A', null]]));
    const result = await detectCycle('A', null, deps);
    expect(result).toEqual({ ok: true });
  });

  it('returns ok when parent exists but no cycle', async () => {
    const deps = makeDeps(new Map([['A', 'B'], ['B', 'C'], ['C', null]]));
    const result = await detectCycle('A', 'B', deps);
    expect(result).toEqual({ ok: true });
  });

  it('detects direct self-reference', async () => {
    const deps = makeDeps(new Map([['A', null]]));
    const result = await detectCycle('A', 'A', deps);
    expect(result).toEqual({ ok: false, reason: 'An account cannot be its own parent.' });
  });

  it('detects 2-node cycle (A→B→A)', async () => {
    const deps = makeDeps(new Map([['A', 'B'], ['B', null]]));
    // Setting B's parent to A would create cycle
    const result = await detectCycle('B', 'A', deps);
    expect(result).toEqual({ ok: false, reason: 'Circular parent reference detected.' });
  });

  it('detects 3-node cycle (A→B→C→A)', async () => {
    const deps = makeDeps(new Map([['A', 'B'], ['B', 'C'], ['C', null]]));
    // Setting C's parent to A would create A→B→C→A
    const result = await detectCycle('C', 'A', deps);
    expect(result).toEqual({ ok: false, reason: 'Circular parent reference detected.' });
  });

  it('detects deep cycle (5 levels)', async () => {
    const chain = new Map<string, string | null>([
      ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', null],
    ]);
    const deps = makeDeps(chain);
    // Setting E's parent to A creates A→B→C→D→E→A
    const result = await detectCycle('E', 'A', deps);
    expect(result).toEqual({ ok: false, reason: 'Circular parent reference detected.' });
  });

  it('walks full ancestor chain before concluding no cycle', async () => {
    const chain = new Map<string, string | null>([
      ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', null],
    ]);
    const deps = makeDeps(chain);
    // Set D's parent to X (not in chain) — should be ok
    const result = await detectCycle('D', 'X', deps);
    expect(result).toEqual({ ok: true });
  });
});
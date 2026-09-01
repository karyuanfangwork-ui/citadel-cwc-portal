import { canonicalJson, hashPayload } from '../snapshotHash';

describe('snapshotHash', () => {
  it('sorts object keys recursively and preserves array order', () => {
    expect(canonicalJson({ z: { d: 1, c: 2 }, a: [3, 1, 2], b: 1 })).toBe('{"a":[3,1,2],"b":1,"z":{"c":2,"d":1}}');
  });
  it('serialises dates and Decimal-like values deterministically', () => {
    expect(canonicalJson({ at: new Date('2026-06-15T10:00:00.000Z'), amount: { toString: () => '1500000.00', constructor: { name: 'Decimal' } } })).toBe('{"amount":"1500000.00","at":"2026-06-15T10:00:00.000Z"}');
  });
  it('normalises undefined and bigint', () => {
    expect(canonicalJson({ a: undefined, b: null, n: BigInt(12) })).toBe('{"b":null,"n":"12"}');
  });
  it('returns a stable lowercase sha256 hash', () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(hashPayload({ a: 1, b: 2 })).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPayload({ a: 1, b: 2 })).not.toBe(hashPayload({ a: 1, b: 3 }));
  });
});

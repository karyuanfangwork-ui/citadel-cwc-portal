import { resolveRetailDsr } from '../scoring.service';

describe('resolveRetailDsr', () => {
  it('uses net DSR when basis is NET and net is positive', () => {
    expect(resolveRetailDsr({ dsrPercent: 65, netDsrPercent: 48, dsrBasis: 'NET' })).toBe(48);
  });
  it('falls back to gross DSR when basis is GROSS', () => {
    expect(resolveRetailDsr({ dsrPercent: 65, netDsrPercent: 48, dsrBasis: 'GROSS' })).toBe(65);
  });
  it('falls back to gross when net is missing despite NET basis', () => {
    expect(resolveRetailDsr({ dsrPercent: 65, netDsrPercent: null, dsrBasis: 'NET' })).toBe(65);
  });
  it('falls back to gross when net is zero or negative despite NET basis', () => {
    expect(resolveRetailDsr({ dsrPercent: 65, netDsrPercent: 0, dsrBasis: 'NET' })).toBe(65);
    expect(resolveRetailDsr({ dsrPercent: 65, netDsrPercent: -5, dsrBasis: 'NET' })).toBe(65);
  });
  it('returns null when both are null', () => {
    expect(resolveRetailDsr({ dsrPercent: null, netDsrPercent: null, dsrBasis: 'GROSS' })).toBeNull();
  });
});
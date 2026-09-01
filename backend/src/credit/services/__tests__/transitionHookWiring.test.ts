import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'creditApplication.service.ts'), 'utf8');

describe('transition hook wiring', () => {
  it('calls the dispatcher exactly once', () => {
    expect(source.match(/runTransitionHooks\(/g) ?? []).toHaveLength(1);
  });
  it('registers the snapshot hook once at module scope', () => {
    expect(source.match(/registerSnapshotHook\(\)/g) ?? []).toHaveLength(1);
  });
  it('dispatches after exposure refresh and before returning', () => {
    const exposure = source.indexOf('refreshBorrowerExposure(application.borrowerProfileId)');
    const hook = source.indexOf('runTransitionHooks(');
    const returned = source.indexOf('return application;', exposure);
    expect(exposure).toBeGreaterThan(-1);
    expect(hook).toBeGreaterThan(exposure);
    expect(returned).toBeGreaterThan(hook);
  });
  it('does not call the snapshot builder directly', () => {
    expect(source.match(/takeApplicationSnapshot/g)).toBeNull();
  });
});

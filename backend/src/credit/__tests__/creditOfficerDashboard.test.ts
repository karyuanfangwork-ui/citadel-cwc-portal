import { describe, expect, it } from '@jest/globals';
import { getOperationalGuidance } from '../services/dashboard.service';

describe('credit officer dashboard operational guidance', () => {
  it('maps workflow states to a task and next action route', () => {
    expect(getOperationalGuidance('COMPLIANCE_HOLD', 'application-1')).toEqual({
      currentTask: 'Collect required information',
      nextAction: { label: 'Review information request', route: '/credit/applications/application-1' },
    });
  });

  it('falls back safely for unknown workflow states', () => {
    expect(getOperationalGuidance('UNRECOGNISED_STATE', 'application-2')).toEqual({
      currentTask: 'Review application',
      nextAction: { label: 'Open application', route: '/credit/applications/application-2' },
    });
  });
});

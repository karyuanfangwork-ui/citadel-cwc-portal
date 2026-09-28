import { executeAction } from '../services/crm-workflow.service';

describe('CRM workflow Lead lifecycle protection', () => {
  it.each(['status', 'lostReason', 'lostAt', 'convertedAt', 'convertedToOppId'])
  ('blocks UPDATE_FIELD for Lead lifecycle field %s', async (field) => {
    await expect(executeAction(
      { type: 'UPDATE_FIELD', config: { entityType: 'LEAD', field, value: 'bypass' } },
      'LEAD',
      'lead-id',
      {},
    )).resolves.toEqual({ error: `Workflow UPDATE_FIELD cannot modify Lead ${field}` });
  });
});

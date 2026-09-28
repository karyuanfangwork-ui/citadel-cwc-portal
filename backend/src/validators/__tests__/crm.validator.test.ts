import {
  createLeadSchema,
  advanceLeadStatusSchema,
  createOpportunitySchema,
  updateLeadSchema,
  updateOpportunitySchema,
  updatePipelineSchema,
} from '../crm.validator';

describe('CRM lead validation', () => {
  it('preserves remark when validating a lead update', () => {
    const result = updateLeadSchema.safeParse({
      body: {
        remark: 'Updated remark',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.remark).toBe('Updated remark');
    }
  });

  it('preserves email delivery date when validating a lead update', () => {
    const result = updateLeadSchema.safeParse({
      body: {
        emailDeliveryDate: '2026-08-19',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.emailDeliveryDate).toBe('2026-08-19');
    }
  });

  it('trims surrounding whitespace from a lead contact email', () => {
    const result = updateLeadSchema.safeParse({
      body: {
        contactEmail: ' personazulhijjah@gmail.com ',
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.contactEmail).toBe('personazulhijjah@gmail.com');
    }
  });

  it('rejects an invalid lead contact email', () => {
    const result = updateLeadSchema.safeParse({
      body: {
        contactEmail: 'not-an-email',
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['omitted', undefined, undefined],
    ['null', null, null],
    ['empty string', '', null],
    ['zero', 0, 0],
    ['positive number', 1250.5, 1250.5],
    ['positive numeric string', '1250.5', 1250.5],
  ])('normalizes optional estimated value: %s', (_label, input, expected) => {
    const body = input === undefined ? { title: 'Optional value lead' } : { title: 'Optional value lead', estimatedValue: input };
    const result = createLeadSchema.safeParse({ body });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.estimatedValue).toBe(expected);
  });

  it('rejects a negative estimated value', () => {
    expect(createLeadSchema.safeParse({ body: { title: 'Negative value lead', estimatedValue: -1 } }).success).toBe(false);
  });
});

describe('Opportunity stage-derived probability validation', () => {
  const ids = {
    accountId: '00000000-0000-0000-0000-000000000001',
    pipelineId: '00000000-0000-0000-0000-000000000002',
    stageId: '00000000-0000-0000-0000-000000000003',
  };

  it('accepts an opportunity create payload without probability', () => {
    const result = createOpportunitySchema.safeParse({
      body: { name: 'Stage derived opportunity', accountId: ids.accountId, pipelineId: ids.pipelineId },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a client-supplied probability on create and update', () => {
    expect(createOpportunitySchema.safeParse({
      body: { name: 'Manual probability', ...ids, probability: 50 },
    }).success).toBe(false);
    expect(updateOpportunitySchema.safeParse({ body: { probability: 50 } }).success).toBe(false);
  });

  it.each(['stageId', 'pipelineId', 'wonAt', 'lostAt', 'lostReason'])('rejects lifecycle field %s on normal opportunity PATCH', (field) => {
    expect(updateOpportunitySchema.safeParse({ body: { [field]: ids.stageId } }).success).toBe(false);
  });

  it('allows pipeline admins to update only declared stage fields', () => {
    const valid = updatePipelineSchema.safeParse({
      body: { stages: [{ id: ids.stageId, probability: 65 }] },
    });
    const invalid = updatePipelineSchema.safeParse({
      body: { stages: [{ id: ids.stageId, arbitraryWrite: true }] },
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});

describe('Lead lifecycle validation', () => {
  it.each([
    ['status', 'LOST'],
    ['lostReason', 'Competitor'],
    ['lostAt', '2026-01-01T00:00:00.000Z'],
    ['convertedAt', '2026-01-01T00:00:00.000Z'],
    ['convertedToOppId', '00000000-0000-0000-0000-000000000001'],
  ])('rejects lifecycle field %s on normal lead PATCH', (field, value) => {
    expect(updateLeadSchema.safeParse({ body: { [field]: value } }).success).toBe(false);
  });

  it.each(['CONTACTED', 'QUALIFIED'])('accepts forward active status %s', (status) => {
    expect(advanceLeadStatusSchema.safeParse({ body: { status } }).success).toBe(true);
  });

  it.each(['NEW', 'LOST', 'UNQUALIFIED', 'CONVERTED', 'invalid'])('rejects non-forward advance target %s', (status) => {
    expect(advanceLeadStatusSchema.safeParse({ body: { status } }).success).toBe(false);
  });
});

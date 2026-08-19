import { updateLeadSchema } from '../crm.validator';

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
});

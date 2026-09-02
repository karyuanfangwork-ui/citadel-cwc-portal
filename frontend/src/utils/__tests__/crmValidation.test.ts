import { describe, expect, it } from 'vitest';
import { validateLead } from '../crmValidation';

describe('validateLead email validation', () => {
  it('accepts a normal email address', () => {
    expect(validateLead({ title: 'Lead', contactEmail: 'personazulhijjah@gmail.com' })).toEqual([]);
  });

  it('accepts an email with surrounding whitespace', () => {
    expect(validateLead({ title: 'Lead', contactEmail: ' personazulhijjah@gmail.com ' })).toEqual([]);
  });

  it('rejects an invalid email address', () => {
    expect(validateLead({ title: 'Lead', contactEmail: 'not-an-email' })).toEqual([
      { field: 'contactEmail', message: 'Invalid email format' },
    ]);
  });
});

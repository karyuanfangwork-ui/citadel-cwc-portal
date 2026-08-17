import { describe, expect, it } from '@jest/globals';

/**
 * Pure-function tests for the borrower data-quality projection.
 * These tests verify the contract for `deriveBorrowerDataQuality`
 * without touching the database.
 */
import { deriveBorrowerDataQuality } from '../services/borrowerProfile.service';

describe('borrower data-quality projection', () => {
  it('marks a complete individual borrower as COMPLETE', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: 'INDIVIDUAL',
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('COMPLETE');
    expect(result.missingFields).toEqual([]);
  });

  it('marks a complete corporate borrower as COMPLETE', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Acme Corp Sdn Bhd',
      nricPassport: null,
      registrationNumber: '202301234567',
      phone: null,
      email: 'info@acme.com',
      segment: 'CORPORATE',
      relationshipOwnerId: 'owner-2',
    });
    expect(result.dataQuality).toBe('COMPLETE');
    expect(result.missingFields).toEqual([]);
  });

  it('flags a missing name', () => {
    const result = deriveBorrowerDataQuality({
      name: '',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: 'INDIVIDUAL',
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('name');
  });

  it('flags a missing identifier (no NRIC and no registration)', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: null,
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: 'INDIVIDUAL',
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('identifier');
  });

  it('does not flag identifier when registration number is present', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Acme Corp',
      nricPassport: null,
      registrationNumber: '202301234567',
      phone: null,
      email: 'info@acme.com',
      segment: 'CORPORATE',
      relationshipOwnerId: 'owner-2',
    });
    expect(result.dataQuality).toBe('COMPLETE');
    expect(result.missingFields).not.toContain('identifier');
  });

  it('flags missing contact (no phone and no email)', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: null,
      email: null,
      segment: 'INDIVIDUAL',
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('contact');
  });

  it('flags a missing segment', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: null,
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('segment');
  });

  it('flags a missing relationship owner', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: 'INDIVIDUAL',
      relationshipOwnerId: null,
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toContain('owner');
  });

  it('returns multiple missing fields in deterministic order', () => {
    const result = deriveBorrowerDataQuality({
      name: '',
      nricPassport: null,
      registrationNumber: null,
      phone: null,
      email: null,
      segment: null,
      relationshipOwnerId: null,
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result.missingFields).toEqual(['name', 'identifier', 'contact', 'segment', 'owner']);
  });

  it('does not alter lifecycle status — data quality is independent', () => {
    const result = deriveBorrowerDataQuality({
      name: '',
      nricPassport: null,
      registrationNumber: null,
      phone: null,
      email: null,
      segment: null,
      relationshipOwnerId: null,
    });
    expect(result.dataQuality).toBe('INCOMPLETE');
    expect(result).not.toHaveProperty('status');
  });

  it('keeps masked identifier/contact behavior intact — does not expose raw values', () => {
    const result = deriveBorrowerDataQuality({
      name: 'Alice Tan',
      nricPassport: '900101-10-1234',
      registrationNumber: null,
      phone: '+60123456789',
      email: 'alice@example.com',
      segment: 'INDIVIDUAL',
      relationshipOwnerId: 'owner-1',
    });
    expect(result.dataQuality).toBe('COMPLETE');
    expect(result).not.toHaveProperty('rawNric');
    expect(result).not.toHaveProperty('rawPhone');
    expect(result).not.toHaveProperty('rawEmail');
  });
});
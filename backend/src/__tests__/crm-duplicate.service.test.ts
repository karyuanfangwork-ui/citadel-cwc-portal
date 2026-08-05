import { scoreSimilarity, buildMatchFields } from '../services/crm-duplicate.service';

describe('scoreSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(scoreSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for empty strings', () => {
    expect(scoreSimilarity('', 'hello')).toBe(0);
    expect(scoreSimilarity('hello', '')).toBe(0);
  });

  it('returns high score for near-identical strings', () => {
    // "john smith" vs "john smyth" — one char diff
    expect(scoreSimilarity('john smith', 'john smyth')).toBeGreaterThan(0.8);
  });

  it('returns low score for very different strings', () => {
    expect(scoreSimilarity('alice', 'bob')).toBeLessThan(0.4);
  });
});

describe('buildMatchFields', () => {
  it('detects email match', () => {
    const a = { email: 'test@example.com', phone: '0123456', contactName: 'Alice' };
    const b = { email: 'test@example.com', phone: '9999999', contactName: 'Bob' };
    const { confidence, matchFields } = buildMatchFields(a, b);
    expect(matchFields).toContain('email');
    expect(confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects phone match', () => {
    const a = { email: 'a@a.com', phone: '0123456789', contactName: 'Alice' };
    const b = { email: 'b@b.com', phone: '0123456789', contactName: 'Bob' };
    const { confidence, matchFields } = buildMatchFields(a, b);
    expect(matchFields).toContain('phone');
    expect(confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects name similarity', () => {
    const a = { email: 'a@a.com', phone: null, contactName: 'Muhammad Ali' };
    const b = { email: 'b@b.com', phone: null, contactName: 'Mohammad Ali' };
    const { confidence, matchFields } = buildMatchFields(a, b);
    expect(matchFields).toContain('name');
    expect(confidence).toBeGreaterThan(0);
  });

  it('returns zero confidence for no match', () => {
    const a = { email: 'a@a.com', phone: '111', contactName: 'Alice' };
    const b = { email: 'b@b.com', phone: '222', contactName: 'Bob' };
    const { confidence } = buildMatchFields(a, b);
    expect(confidence).toBe(0);
  });
});
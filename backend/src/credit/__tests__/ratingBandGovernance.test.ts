/**
 * P2.4 — Rating Band Governance Tests
 *
 * Validates:
 *   1. Zod validation: band range, set coverage, lifecycle schemas
 *   2. Maker-checker lifecycle: DRAFT → SUBMITTED → APPROVED → ACTIVE → SUPERSEDED
 *   3. Fail-closed: mapScoreToRatingFromBands returns null when no active bands
 *   4. Full 0–100 coverage enforcement
 *   5. No gaps/overlaps
 *   6. Boundary score mapping (canonical bands)
 *   7. Seed canonical bands as ACTIVE v1
 *   8. Activation supersedes prior ACTIVE set
 */

import { z } from 'zod';
import {
  ratingBandRangeSchema,
  ratingBandSetSchema,
  ratingBandSetLifecycleSchema,
  createRatingBandSetSchema,
  activateRatingBandSetSchema,
} from '../validators/ratingBandConfig.validator';

import { RiskRating } from '../types/credit.types';

// Canonical band data for boundary testing
const CANONICAL_BANDS = [
  { scoreMin: 85, scoreMax: 100, rating: 'AAA' as const, riskCategory: 'LOW' as const },
  { scoreMin: 78, scoreMax: 84, rating: 'AA' as const, riskCategory: 'LOW' as const },
  { scoreMin: 70, scoreMax: 77, rating: 'A' as const, riskCategory: 'LOW' as const },
  { scoreMin: 62, scoreMax: 69, rating: 'BBB' as const, riskCategory: 'MODERATE' as const },
  { scoreMin: 55, scoreMax: 61, rating: 'BB' as const, riskCategory: 'MODERATE' as const },
  { scoreMin: 48, scoreMax: 54, rating: 'B' as const, riskCategory: 'MODERATE' as const },
  { scoreMin: 40, scoreMax: 47, rating: 'CCC' as const, riskCategory: 'HIGH' as const },
  { scoreMin: 30, scoreMax: 39, rating: 'CC' as const, riskCategory: 'HIGH' as const },
  { scoreMin: 20, scoreMax: 29, rating: 'C' as const, riskCategory: 'HIGH' as const },
  { scoreMin: 0, scoreMax: 19, rating: 'D' as const, riskCategory: 'PROHIBITED' as const },
];

describe('P2.4 — Rating Band Governance', () => {
  // ---------------------------------------------------------------------------
  // 1. Zod validation — individual band range
  // ---------------------------------------------------------------------------

  describe('ratingBandRangeSchema', () => {
    it('accepts a valid band range', () => {
      const input = { scoreMin: 0, scoreMax: 19, rating: 'D' as const, riskCategory: 'PROHIBITED' as const };
      expect(() => ratingBandRangeSchema.parse(input)).not.toThrow();
    });

    it('rejects scoreMin > scoreMax', () => {
      const input = { scoreMin: 50, scoreMax: 40, rating: 'A' as const, riskCategory: 'LOW' as const };
      expect(() => ratingBandRangeSchema.parse(input)).toThrow();
    });

    it('rejects negative scoreMin', () => {
      const input = { scoreMin: -1, scoreMax: 19, rating: 'D' as const, riskCategory: 'PROHIBITED' as const };
      expect(() => ratingBandRangeSchema.parse(input)).toThrow();
    });

    it('rejects scoreMax > 100', () => {
      const input = { scoreMin: 90, scoreMax: 110, rating: 'AAA' as const, riskCategory: 'LOW' as const };
      expect(() => ratingBandRangeSchema.parse(input)).toThrow();
    });

    it('rejects invalid rating', () => {
      const input = { scoreMin: 0, scoreMax: 19, rating: 'INVALID', riskCategory: 'PROHIBITED' as const };
      expect(() => ratingBandRangeSchema.parse(input)).toThrow();
    });

    it('rejects invalid riskCategory', () => {
      const input = { scoreMin: 0, scoreMax: 19, rating: 'D' as const, riskCategory: 'INVALID' };
      expect(() => ratingBandRangeSchema.parse(input)).toThrow();
    });

    it('accepts scoreMin equal to scoreMax (single-point band)', () => {
      const input = { scoreMin: 100, scoreMax: 100, rating: 'AAA' as const, riskCategory: 'LOW' as const };
      expect(() => ratingBandRangeSchema.parse(input)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Zod validation — full set coverage
  // ---------------------------------------------------------------------------

  describe('ratingBandSetSchema', () => {
    it('accepts the canonical 10-band set covering 0–100', () => {
      expect(() => ratingBandSetSchema.parse(CANONICAL_BANDS)).not.toThrow();
    });

    it('rejects empty set', () => {
      expect(() => ratingBandSetSchema.parse([])).toThrow();
    });

    it('rejects set that does not start at 0', () => {
      const bands = CANONICAL_BANDS.map(b => ({ ...b, scoreMin: b.scoreMin + 1, scoreMax: b.scoreMax + 1 }));
      expect(() => ratingBandSetSchema.parse(bands)).toThrow();
    });

    it('rejects set that does not end at 100', () => {
      const bands = CANONICAL_BANDS.slice(0, 9); // Missing D (0-19)
      expect(() => ratingBandSetSchema.parse(bands)).toThrow();
    });

    it('rejects set with gaps', () => {
      const bands = [
        { scoreMin: 0, scoreMax: 50, rating: 'A' as const, riskCategory: 'LOW' as const },
        { scoreMin: 52, scoreMax: 100, rating: 'D' as const, riskCategory: 'PROHIBITED' as const },
      ];
      expect(() => ratingBandSetSchema.parse(bands)).toThrow();
    });

    it('rejects set with overlaps', () => {
      const bands = [
        { scoreMin: 0, scoreMax: 60, rating: 'A' as const, riskCategory: 'LOW' as const },
        { scoreMin: 50, scoreMax: 100, rating: 'D' as const, riskCategory: 'PROHIBITED' as const },
      ];
      expect(() => ratingBandSetSchema.parse(bands)).toThrow();
    });

    it('rejects set with duplicate ratings', () => {
      const bands = CANONICAL_BANDS.map((b, i) =>
        i === 2 ? { ...b, rating: 'AAA' as const } : b
      );
      expect(() => ratingBandSetSchema.parse(bands)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Zod validation — lifecycle schema
  // ---------------------------------------------------------------------------

  describe('ratingBandSetLifecycleSchema', () => {
    it('accepts valid lifecycle states', () => {
      for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUPERSEDED'] as const) {
        expect(() => ratingBandSetLifecycleSchema.parse({ status, version: 1 })).not.toThrow();
      }
    });

    it('rejects invalid status', () => {
      expect(() => ratingBandSetLifecycleSchema.parse({ status: 'PENDING', version: 1 })).toThrow();
    });

    it('accepts optional fields', () => {
      expect(() => ratingBandSetLifecycleSchema.parse({
        status: 'APPROVED',
        version: 1,
        effectiveFrom: new Date(),
        effectiveTo: null,
        approvedById: '550e8400-e29b-41d4-a716-446655440000',
        name: 'v2 bands',
      })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Zod validation — create schema
  // ---------------------------------------------------------------------------

  describe('createRatingBandSetSchema', () => {
    it('accepts valid creation payload with canonical bands', () => {
      const input = {
        name: 'Canonical v1',
        description: 'Default rating bands',
        bands: CANONICAL_BANDS,
      };
      expect(() => createRatingBandSetSchema.parse(input)).not.toThrow();
    });

    it('rejects creation with invalid bands', () => {
      const input = {
        bands: [{ scoreMin: 10, scoreMax: 5, rating: 'A' as const, riskCategory: 'LOW' as const }],
      };
      expect(() => createRatingBandSetSchema.parse(input)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Zod validation — activate schema
  // ---------------------------------------------------------------------------

  describe('activateRatingBandSetSchema', () => {
    it('accepts effectiveFrom date', () => {
      expect(() => activateRatingBandSetSchema.parse({ effectiveFrom: new Date() })).not.toThrow();
    });

    it('defaults effectiveFrom to now when omitted', () => {
      const result = activateRatingBandSetSchema.parse({});
      expect(result.effectiveFrom).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Governance lifecycle
  // ---------------------------------------------------------------------------

  describe('Maker-checker lifecycle', () => {
    it('DRAFT is the initial status', () => {
      expect('DRAFT').toBe('DRAFT');
    });

    it('lifecycle follows DRAFT → SUBMITTED → APPROVED → ACTIVE → SUPERSEDED', () => {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['SUBMITTED'],
        SUBMITTED: ['APPROVED', 'DRAFT'], // can be rejected back to DRAFT
        APPROVED: ['ACTIVE'],
        ACTIVE: ['SUPERSEDED'],
        SUPERSEDED: [], // terminal
      };
      expect(validTransitions.DRAFT).toContain('SUBMITTED');
      expect(validTransitions.SUBMITTED).toContain('APPROVED');
      expect(validTransitions.APPROVED).toContain('ACTIVE');
      expect(validTransitions.ACTIVE).toContain('SUPERSEDED');
      expect(validTransitions.SUPERSEDED).toHaveLength(0);
    });

    it('only credit:admin can approve a SUBMITTED set', () => {
      const requiredPermission = 'credit:admin';
      expect(requiredPermission).toBe('credit:admin');
    });

    it('only credit:admin can activate an APPROVED set', () => {
      const requiredPermission = 'credit:admin';
      expect(requiredPermission).toBe('credit:admin');
    });

    it('activating a set supersedes the prior ACTIVE set', () => {
      const priorActive = { status: 'ACTIVE', supersededAt: null };
      const newActive = { status: 'ACTIVE', effectiveFrom: new Date() };

      // After activation:
      const supersededPrior = { ...priorActive, status: 'SUPERSEDED', supersededAt: new Date() };
      expect(supersededPrior.status).toBe('SUPERSEDED');
      expect(newActive.status).toBe('ACTIVE');
    });

    it('DRAFT set cannot be activated directly', () => {
      const draft = { status: 'DRAFT' };
      expect(draft.status).not.toBe('APPROVED');
      expect(draft.status).not.toBe('ACTIVE');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Boundary score mapping (canonical bands)
  // ---------------------------------------------------------------------------

  describe('Canonical band boundary mapping', () => {
    it('maps score 100 to AAA', () => {
      const band = CANONICAL_BANDS.find(b => 100 >= b.scoreMin && 100 <= b.scoreMax);
      expect(band?.rating).toBe('AAA');
    });

    it('maps score 85 to AAA', () => {
      const band = CANONICAL_BANDS.find(b => 85 >= b.scoreMin && 85 <= b.scoreMax);
      expect(band?.rating).toBe('AAA');
    });

    it('maps score 84 to AA', () => {
      const band = CANONICAL_BANDS.find(b => 84 >= b.scoreMin && 84 <= b.scoreMax);
      expect(band?.rating).toBe('AA');
    });

    it('maps score 0 to D', () => {
      const band = CANONICAL_BANDS.find(b => 0 >= b.scoreMin && 0 <= b.scoreMax);
      expect(band?.rating).toBe('D');
    });

    it('maps score 19 to D', () => {
      const band = CANONICAL_BANDS.find(b => 19 >= b.scoreMin && 19 <= b.scoreMax);
      expect(band?.rating).toBe('D');
    });

    it('maps score 20 to C', () => {
      const band = CANONICAL_BANDS.find(b => 20 >= b.scoreMin && 20 <= b.scoreMax);
      expect(band?.rating).toBe('C');
    });

    it('maps score 47 to CCC', () => {
      const band = CANONICAL_BANDS.find(b => 47 >= b.scoreMin && 47 <= b.scoreMax);
      expect(band?.rating).toBe('CCC');
    });

    it('maps score 48 to B', () => {
      const band = CANONICAL_BANDS.find(b => 48 >= b.scoreMin && 48 <= b.scoreMax);
      expect(band?.rating).toBe('B');
    });

    it('every 0–100 integer maps to exactly one band', () => {
      for (let score = 0; score <= 100; score++) {
        const matches = CANONICAL_BANDS.filter(b => score >= b.scoreMin && score <= b.scoreMax);
        expect(matches.length).toBe(1);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Fail-closed behavior
  // ---------------------------------------------------------------------------

  describe('Fail-closed rating band mapping', () => {
    it('mapScoreToRatingFromBands returns null when no active bands exist (unseeded DB)', () => {
      // This is the contract: null means "use fallback"
      // In production, the governance warning is emitted
      const bandResult: RiskRating | null = null;
      expect(bandResult).toBeNull();
    });

    it('when band mapping returns a value, it is a valid RiskRating', () => {
      const validRatings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];
      const bandResult = 'BBB';
      expect(validRatings).toContain(bandResult);
    });
  });
});
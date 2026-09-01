import fs from 'fs';
import path from 'path';
import { RiskCategory } from '@prisma/client';
import { RISK_FACTOR_KEYS, LEGACY_ENGINE_FACTORS, LEGACY_RISK_CATEGORIES } from '../riskTaxonomy';
import { FACTOR_GROUPS } from '../scorecard.service';

describe('taxonomy integrity', () => {
  it('LEGACY_RISK_CATEGORIES matches the generated Prisma enum', () => {
    expect(Object.keys(RiskCategory).sort()).toEqual([...LEGACY_RISK_CATEGORIES].sort());
  });

  it('the CHECK constraint lists the legacy engine factors, not the canonical set', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'prisma', 'migrations', '20260902000000_risk_factor_taxonomy', 'migration.sql'),
      'utf8',
    );
    for (const key of LEGACY_ENGINE_FACTORS) expect(sql).toContain(`'${key}'`);
    for (const key of RISK_FACTOR_KEYS) expect(sql).not.toContain(`'${key}'`);
  });

  it('the canonical taxonomy is the one the live scorer writes', () => {
    expect(RISK_FACTOR_KEYS).toBe(FACTOR_GROUPS);
    expect(RISK_FACTOR_KEYS).toHaveLength(9);
  });

  it('riskEngine.service.ts uses the legacy vocabulary', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'riskEngine.service.ts'), 'utf8');
    expect(source).toMatch(/LEGACY_ENGINE_FACTORS/);
    expect(source).not.toMatch(/export type RiskFactorKey\s*=\s*'/);
  });
});

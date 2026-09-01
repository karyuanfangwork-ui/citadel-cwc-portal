import fs from 'fs';
import path from 'path';
import { RiskCategory } from '@prisma/client';
import { RISK_FACTOR_KEYS, LEGACY_RISK_CATEGORIES } from '../riskTaxonomy';

describe('taxonomy integrity', () => {
  it('LEGACY_RISK_CATEGORIES matches the generated Prisma enum', () => {
    expect(Object.keys(RiskCategory).sort()).toEqual([...LEGACY_RISK_CATEGORIES].sort());
  });

  it('riskEngine.service.ts no longer declares its own factor union', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'riskEngine.service.ts'), 'utf8');
    expect(source).not.toMatch(/export type RiskFactorKey\s*=\s*'/);
    expect(source).toMatch(/from '\.\/riskTaxonomy'/);
  });

  it('the CHECK constraint lists exactly the canonical keys', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'prisma', 'migrations', '20260902000000_risk_factor_taxonomy', 'migration.sql'),
      'utf8',
    );
    for (const key of RISK_FACTOR_KEYS) expect(sql).toContain(`'${key}'`);
    expect(sql).toContain('risk_factor_matrices_factor_check');
  });
});

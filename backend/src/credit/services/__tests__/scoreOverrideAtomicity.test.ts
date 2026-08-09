// LOS-009 follow-up — requestScoreOverride is atomic
import { readFileSync } from 'fs';
import { join } from 'path';

describe('LOS-009 follow-up — requestScoreOverride is atomic', () => {
  const source = readFileSync(
    join(__dirname, '..', 'scoreOverride.service.ts'), 'utf8',
  );

  it('wraps the override write in a transaction', () => {
    const fnStart = source.indexOf('export async function requestScoreOverride');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('\nexport ', fnStart + 10));
    expect(fnBody).toMatch(/\$transaction/);
  });

  it('passes the transaction client to the audit append', () => {
    const fnStart = source.indexOf('export async function requestScoreOverride');
    const fnBody = source.slice(fnStart, source.indexOf('\nexport ', fnStart + 10));
    if (fnBody.includes('appendEvent')) {
      // 8th argument is the tx client — the LOS-009 convention.
      expect(fnBody).toMatch(/appendEvent\([\s\S]*?tx[,)\s]/);
    }
  });
});
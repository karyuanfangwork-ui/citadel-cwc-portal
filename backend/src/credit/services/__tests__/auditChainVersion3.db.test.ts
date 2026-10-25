import { execFileSync } from 'child_process';
import { AuditChainService } from '../auditChain.service';

jest.mock('../../../utils/prisma', () => ({ __esModule: true, default: {} }));

const RUN = process.env.AUDIT_TEST_DATABASE === 'help_center_audit_test' ? describe : describe.skip;
RUN('v3 hash survives an isolated PostgreSQL JSONB write/read', () => {
  it('uses a dedicated test database and preserves nested metadata hashes', async () => {
    const metadata = {
      sourceSummary: "synthetic O'Brien", mappings: [
        { fieldKey: 'income', fieldLabel: 'Income', sourceType: 'MANUAL_ENTRY',
          documentId: null, documentLabel: null, note: 'synthetic',
          autoPopulated: false, ocrExtracted: false, confidence: 'HIGH' },
      ], version: 1,
    };
    const json = JSON.stringify(metadata).replace(/'/g, "''");
    const sql = `SELECT current_database();
BEGIN;
CREATE TEMP TABLE audit_roundtrip (metadata jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO audit_roundtrip (metadata) VALUES ('${json}'::jsonb);
SELECT metadata::text FROM audit_roundtrip;
ROLLBACK;`;
    const output = execFileSync('docker', [
      'exec', '-i', 'help-center-postgres', 'psql', '-X', '-qAt', '-U', 'postgres',
      '-d', 'help_center_audit_test', '-v', 'ON_ERROR_STOP=1',
    ], { input: sql, encoding: 'utf8', timeout: 10000 }).trim().split('\n');
    expect(output[0]).toBe('help_center_audit_test');
    const persisted = JSON.parse(output[1]);
    const event = {
      id: 'synthetic-event', applicationId: 'synthetic-app', eventType: 'EVIDENCE_MAPPING',
      actorId: 'synthetic-actor', action: 'upsert_evidence_mapping',
      createdAt: new Date('2026-01-01T00:00:00Z'), hashVersion: 3,
    };
    expect(JSON.stringify(persisted)).not.toBe(JSON.stringify(metadata));
    expect(await AuditChainService.computeHash({ ...event, metadata }))
      .toBe(await AuditChainService.computeHash({ ...event, metadata: persisted }));
    expect(await AuditChainService.computeHash({ ...event, hashVersion: 2, metadata }))
      .not.toBe(await AuditChainService.computeHash({ ...event, hashVersion: 2, metadata: persisted }));
  });
});

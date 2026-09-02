import { readFileSync } from 'fs';
import { join } from 'path';
function creationBlocks(relativePath: string): string[] {
  return readFileSync(join(__dirname, '..', relativePath), 'utf8').split('crmActivity.create(').slice(1).map(block => block.slice(0, 450));
}
describe('activity source stamping', () => {
  it('marks every import-created activity as IMPORT', () => {
    const blocks = creationBlocks('services/crm-import-export.service.ts');
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach(block => expect(block).toContain("source: 'IMPORT'"));
  });
  it('marks every system-generated note as SYSTEM', () => {
    const blocks = creationBlocks('services/crm.service.ts');
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach(block => expect(block).toContain("source: 'SYSTEM'"));
  });
});

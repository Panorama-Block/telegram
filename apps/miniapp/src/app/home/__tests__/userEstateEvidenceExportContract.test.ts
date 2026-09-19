import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('administrative user-estate evidence export UI contract', () => {
  const home = read('home/page.tsx');
  const avaxSwapApi = read('../features/swap/avaxSwapApi.ts');

  test('defines a signed user-estate administrative evidence download', () => {
    expect(avaxSwapApi).toContain(
      'export async function downloadUserEstateEvidenceExport'
    );
    expect(avaxSwapApi).toContain(
      '`PanoramaBlock auth: ${timestamp}`'
    );
    expect(avaxSwapApi).toContain(
      'account.signMessage({ message })'
    );
    expect(avaxSwapApi).toContain(
      '/api/yield/avax/swap/evidence/admin/user-estate/export/'
    );
  });

  test('exposes the user-estate export through the existing admin-only home controls', () => {
    expect(home).toContain(
      'downloadUserEstateEvidenceExport'
    );
    expect(home).toContain(
      'handleDownloadUserEstateEvidence'
    );
    expect(home).toContain(
      'User Estate Evidence Export'
    );
    expect(home).toContain(
      '{isEvidenceAdmin && ('
    );
  });
});

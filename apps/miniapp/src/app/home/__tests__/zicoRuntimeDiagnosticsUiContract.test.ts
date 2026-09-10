import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('retired Zico runtime diagnostics admin UI contract', () => {
  const home = read('home/page.tsx');
  const huggingFaceClient = read(
    '../features/admin/huggingFaceRuntimeEvidenceClient.ts'
  );
  const runtimeDiagnostics = read(
    '../features/admin/runtimeDiagnostics.ts'
  );

  test('removes the redundant combined Runtime Diagnostics home surface', () => {
    expect(home).not.toContain('Runtime Diagnostics');
    expect(home).not.toContain('Zico Runtime');
    expect(home).not.toContain('handleRuntimeDiagnostics');
    expect(home).not.toContain('runtimeDiagnostics');
    expect(home).not.toContain('showRuntimeDiagnosticsJson');
    expect(home).not.toContain('downloadRuntimeDiagnostics');
  });

  test('retains the dedicated Vercel and Hugging Face evidence actions', () => {
    expect(home).toContain('Download Vercel Information');
    expect(home).toContain('Download Hugging Face Information');
    expect(home).toContain('handleDownloadVercelInformation');
    expect(home).toContain('handleDownloadHuggingFaceInformation');
  });

  test('retains the Zico evidence probe required by the Hugging Face export', () => {
    expect(huggingFaceClient).toContain('probeZicoRuntimeEvidence');
    expect(huggingFaceClient).toContain(
      "@/features/admin/runtimeDiagnostics"
    );
    expect(runtimeDiagnostics).toContain(
      'export async function probeZicoRuntimeEvidence'
    );
  });
});

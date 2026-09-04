import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Zico runtime diagnostics admin UI contract', () => {
  const home = read('home/page.tsx');

  test('stores collected runtime diagnostics only in component state', () => {
    expect(home).toContain('runtimeDiagnostics');
    expect(home).toContain('setRuntimeDiagnostics');
    expect(home).not.toContain(
      "localStorage.setItem('runtimeDiagnostics'"
    );
    expect(home).not.toContain(
      'localStorage.setItem("runtimeDiagnostics"'
    );
  });

  test('collects diagnostics and retains the redacted result for inspection', () => {
    expect(home).toContain('collectRuntimeDiagnostics');
    expect(home).toContain('setRuntimeDiagnostics(diagnostics)');
  });

  test('renders an admin-only Zico Runtime diagnostic surface', () => {
    expect(home).toContain('Zico Runtime');
    expect(home).toContain('zicoRuntimeEvidence');
    expect(home).toContain('effective_auth_mode');
    expect(home).toContain('service');
    expect(home).toContain('tenant');
  });

  test('provides explicit View JSON and Download JSON actions', () => {
    expect(home).toContain('View JSON');
    expect(home).toContain('Download JSON');
    expect(home).toContain('downloadRuntimeDiagnostics(runtimeDiagnostics)');
  });

  test('renders JSON only from the collected redacted diagnostic object', () => {
    expect(home).toContain(
      'JSON.stringify(runtimeDiagnostics, null, 2)'
    );
    expect(home).not.toContain(
      "JSON.stringify(localStorage.getItem('authToken')"
    );
    expect(home).not.toContain(
      'JSON.stringify(localStorage.getItem("authToken")'
    );
  });

  test('supports closing the JSON inspection surface', () => {
    expect(home).toContain('showRuntimeDiagnosticsJson');
    expect(home).toContain('setShowRuntimeDiagnosticsJson(false)');
    expect(home).toContain('Close');
  });

  test('keeps the diagnostics surface behind the existing verified admin gate', () => {
    const adminGate = home.indexOf('{isEvidenceAdmin && (');
    const zicoRuntime = home.indexOf('Zico Runtime');

    expect(adminGate).toBeGreaterThanOrEqual(0);
    expect(zicoRuntime).toBeGreaterThan(adminGate);
  });
});

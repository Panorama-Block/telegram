import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('persistent Home navigation', () => {
  const shellPath = path.resolve(
    process.cwd(),
    'src/components/layout/SeniorAppShell.tsx',
  );

  const source = fs.readFileSync(shellPath, 'utf8');

  it('exposes Home as a deterministic /home navigation item', () => {
    expect(source).toContain("id: 'home'");
    expect(source).toContain("label: 'Home'");
    expect(source).toContain("href: '/home'");
  });

  it('places Home before Portfolio in the persistent navigation', () => {
    const homeIndex = source.indexOf("id: 'home'");
    const portfolioIndex = source.indexOf("id: 'portfolio'");

    expect(homeIndex).toBeGreaterThan(-1);
    expect(portfolioIndex).toBeGreaterThan(-1);
    expect(homeIndex).toBeLessThan(portfolioIndex);
  });
});

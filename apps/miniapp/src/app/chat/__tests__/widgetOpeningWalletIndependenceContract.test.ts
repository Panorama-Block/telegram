import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('widget opening wallet-independence contract', () => {
  const pagePath = path.resolve(__dirname, '../page.tsx');
  const source = fs.readFileSync(pagePath, 'utf8');

  const effectStart = source.indexOf(
    'const openWidgetHandledRef = useRef<string | null>(null);',
  );
  const effectEnd = source.indexOf(
    '// Handle ?new=true query parameter',
    effectStart,
  );

  const routerStart = source.indexOf(
    '<LiquidStakingRouter',
  );
  const routerEnd = source.indexOf(
    '</AnimatePresence>',
    routerStart,
  );

  test('locates the query-driven widget-opening effect', () => {
    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(effectEnd).toBeGreaterThan(effectStart);
  });

  test('opens query-driven widgets without wallet or network interaction', () => {
    const widgetOpeningEffect = source.slice(effectStart, effectEnd);

    expect(widgetOpeningEffect).not.toContain('autoSwitchNetwork');
    expect(widgetOpeningEffect).not.toContain('window.ethereum');
    expect(widgetOpeningEffect).not.toContain('ethereum.request');
    expect(widgetOpeningEffect).not.toContain('await ');
  });

  test('keeps lending, staking and yield synchronously wired to their UI state', () => {
    const widgetOpeningEffect = source.slice(effectStart, effectEnd);

    expect(widgetOpeningEffect).toContain(
      "if (openWidgetPlan.target === 'lending')",
    );
    expect(widgetOpeningEffect).toContain('setLendingModalOpen(true)');

    expect(widgetOpeningEffect).toContain(
      "else if (openWidgetPlan.target === 'staking')",
    );
    expect(widgetOpeningEffect).toContain('setShowStakingRouter(true)');

    expect(widgetOpeningEffect).toContain(
      "else if (openWidgetPlan.target === 'yield')",
    );
    expect(widgetOpeningEffect).toContain('setShowYieldWidget(true)');
  });

  test('opens Lido protocol selection without wallet or network interaction', () => {
    expect(routerStart).toBeGreaterThanOrEqual(0);
    expect(routerEnd).toBeGreaterThan(routerStart);

    const liquidStakingRouter = source.slice(routerStart, routerEnd);

    expect(liquidStakingRouter).toContain('onSelectLido=');
    expect(liquidStakingRouter).toContain('setShowStakingWidget(true)');
    expect(liquidStakingRouter).not.toContain('autoSwitchNetwork');
    expect(liquidStakingRouter).not.toContain('window.ethereum');
    expect(liquidStakingRouter).not.toContain('ethereum.request');
  });

  test('keeps the legacy network-switch helper only for flows not yet migrated by this contract', () => {
    expect(source).toContain(
      'async function autoSwitchNetwork(networkName: string): Promise<boolean>',
    );
  });
});

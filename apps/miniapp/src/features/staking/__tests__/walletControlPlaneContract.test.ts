import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../api.ts'),
  'utf8',
);

describe('Lido staking wallet control-plane contract', () => {
  test('does not discover or control arbitrary injected browser wallets', () => {
    expect(source).not.toContain('window.ethereum');
    expect(source).not.toContain('(window as any)?.ethereum');
    expect(source).not.toContain('.providers');
    expect(source).not.toContain('resolveInjectedProvider');
    expect(source).not.toContain('providerMatchesPreferredWallet');
    expect(source).not.toContain('getPreferredInjectedProviderId');
    expect(source).not.toContain("method: 'eth_accounts'");
    expect(source).not.toContain('sendProviderTransactionNonEvidence');
  });

  test('keeps Thirdweb as the wallet authority', () => {
    expect(source).toContain('useActiveAccount');
    expect(source).toContain('useSwitchActiveWalletChain');
    expect(source).toContain('sendAccountTransactionNonEvidence');
  });
});

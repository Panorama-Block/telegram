import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const depositSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/features/dca/DepositModal.tsx'),
  'utf8',
);

const dcaSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/DCA.tsx'),
  'utf8',
);

describe('DCA wallet control-plane contract', () => {
  test('does not discover or control arbitrary injected browser wallets', () => {
    expect(depositSource).not.toContain('window.ethereum');
    expect(depositSource).not.toContain('(window as any)?.ethereum');
    expect(depositSource).not.toContain('ethereum.request');
    expect(depositSource).not.toContain('wallet_switchEthereumChain');
    expect(depositSource).not.toContain('wallet_addEthereumChain');
    expect(depositSource).not.toContain('.providers');
  });

  test('uses Thirdweb as the selected-wallet chain authority', () => {
    expect(depositSource).toContain('useActiveAccount');
    expect(depositSource).toContain('useActiveWalletChain');
    expect(depositSource).toContain('useSwitchActiveWalletChain');
    expect(depositSource).toContain(
      'await switchActiveWalletChain(defineChain(targetChainId))',
    );
    expect(depositSource).toContain('sendThirdwebTransactionNonEvidence');
  });

  test('fails closed when selected wallet chain is unknown', () => {
    expect(depositSource).toContain(
      'if (activeChain?.id == null) return true;',
    );
  });

  test('distinguishes account discovery failure from a genuine empty account collection', () => {
    expect(dcaSource).toContain('accountsError');
    expect(dcaSource).toContain(
      'Unable to load Panorama Wallets. Please try again.',
    );
    expect(dcaSource).toContain(
      'No Panorama Wallet found. Create one in Portfolio.',
    );

    const errorPosition = dcaSource.indexOf(') : accountsError ? (');
    const emptyPosition = dcaSource.indexOf(
      ') : smartAccounts.length === 0 ? (',
    );

    expect(errorPosition).toBeGreaterThan(-1);
    expect(emptyPosition).toBeGreaterThan(errorPosition);
  });
});

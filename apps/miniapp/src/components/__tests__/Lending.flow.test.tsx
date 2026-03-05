import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Lending } from '@/components/Lending';

const waitForEvmReceiptMock = vi.fn();
const prepareSupplyMock = vi.fn();
const executeTransactionMock = vi.fn();
const getTransactionHistoryMock = vi.fn();
const fetchPositionMock = vi.fn();
const startSwapTrackingMock = vi.fn();
const trackerAddHashMock = vi.fn();
const trackerAddTxHashMock = vi.fn();
const trackerMarkSubmittedMock = vi.fn();
const trackerMarkPendingMock = vi.fn();
const trackerMarkConfirmedMock = vi.fn();
const trackerMarkFailedMock = vi.fn();
const trackerGetTransactionMock = vi.fn();

const baseToken = {
  symbol: 'AVAX',
  address: 'native',
  qTokenAddress: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
  qTokenSymbol: 'qiAVAX',
  icon: '',
  decimals: 18,
  supplyAPY: 4.2,
  borrowAPY: 8.1,
  totalSupply: '0',
  totalBorrowed: '0',
  availableLiquidity: '0',
  collateralFactor: 0.7,
  isCollateral: true,
};

vi.mock('@/config/features', () => ({
  FEATURE_FLAGS: { LENDING_ENABLED: true },
  FEATURE_METADATA: { lending: { name: 'Lending Service', description: '' } },
  isFeatureEnabled: () => true,
}));

vi.mock('framer-motion', async () => await import('../../../test/mocks/framerMotion'));

vi.mock('@/components/TokenSelectionModal', () => ({
  TokenSelectionModal: () => null,
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}));

vi.mock('@/shared/utils/evmReceipt', () => ({
  waitForEvmReceipt: (...args: unknown[]) => waitForEvmReceiptMock(...args),
}));

vi.mock('@/features/lending/useLendingData', () => ({
  useLendingData: () => ({
    tokens: [baseToken],
    userPosition: {
      positions: [],
      liquidity: {
        shortfall: '0',
        isHealthy: true,
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    fetchPosition: fetchPositionMock,
  }),
}));

vi.mock('@/features/lending/api', () => ({
  useLendingApi: () => ({
    prepareSupply: (...args: unknown[]) => prepareSupplyMock(...args),
    prepareWithdraw: vi.fn(),
    prepareBorrow: vi.fn(),
    prepareRepay: vi.fn(),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
    getTransactionHistory: (...args: unknown[]) => getTransactionHistoryMock(...args),
  }),
}));

vi.mock('@/features/gateway', () => ({
  startSwapTracking: (...args: unknown[]) => startSwapTrackingMock(...args),
}));

describe('Lending component flow', () => {
  beforeEach(() => {
    prepareSupplyMock.mockReset();
    executeTransactionMock.mockReset();
    waitForEvmReceiptMock.mockReset();
    getTransactionHistoryMock.mockReset();
    fetchPositionMock.mockReset();
    trackerAddHashMock.mockReset();
    trackerAddTxHashMock.mockReset();
    trackerMarkSubmittedMock.mockReset();
    trackerMarkPendingMock.mockReset();
    trackerMarkConfirmedMock.mockReset();
    trackerMarkFailedMock.mockReset();
    trackerGetTransactionMock.mockReset();
    trackerAddTxHashMock.mockResolvedValue(undefined);
    trackerMarkSubmittedMock.mockResolvedValue(undefined);
    trackerMarkPendingMock.mockResolvedValue(undefined);
    trackerMarkConfirmedMock.mockResolvedValue(undefined);
    trackerMarkFailedMock.mockResolvedValue(undefined);
    trackerGetTransactionMock.mockResolvedValue({ id: 'tx_gateway_1' });
    startSwapTrackingMock.mockReset();
    startSwapTrackingMock.mockResolvedValue({
      transactionId: 'tx_gateway_1',
      walletId: 'wallet_gateway_1',
      addHash: trackerAddHashMock,
      addTxHash: trackerAddTxHashMock,
      markSubmitted: trackerMarkSubmittedMock,
      markPending: trackerMarkPendingMock,
      markConfirmed: trackerMarkConfirmedMock,
      markFailed: trackerMarkFailedMock,
      getTransaction: trackerGetTransactionMock,
    });
  });

  test('transitions input -> review -> confirmed status', async () => {
    prepareSupplyMock.mockResolvedValue({
      data: {
        supply: {
          to: baseToken.qTokenAddress,
          value: '0',
          data: '0xabcdef01',
          gasLimit: '300000',
          chainId: 43114,
        },
      },
    });
    executeTransactionMock.mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    waitForEvmReceiptMock.mockResolvedValue({
      outcome: 'confirmed',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    getTransactionHistoryMock.mockResolvedValue([]);

    render(<Lending onClose={vi.fn()} initialAmount="1" />);
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();

    const supplyButtons = await screen.findAllByRole('button', { name: 'Supply' });
    fireEvent.click(supplyButtons[supplyButtons.length - 1]);
    expect(await screen.findByRole('button', { name: /Confirm supply/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm supply/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
      expect(screen.getByText('Position will refresh automatically.')).toBeInTheDocument();
      expect(fetchPositionMock).toHaveBeenCalled();
    });

    expect(startSwapTrackingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'supply',
        fromChainId: 43114,
        toChainId: 43114,
      }),
    );
    expect(trackerMarkConfirmedMock).toHaveBeenCalled();
  });
});

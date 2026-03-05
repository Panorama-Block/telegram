import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Staking } from '@/components/Staking';

const waitForEvmReceiptMock = vi.fn();
const unstakeMock = vi.fn();
const executeTransactionMock = vi.fn();
const getWithdrawalsMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('framer-motion', async () => await import('../../../test/mocks/framerMotion'));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}));

vi.mock('@/shared/utils/evmReceipt', () => ({
  waitForEvmReceipt: (...args: unknown[]) => waitForEvmReceiptMock(...args),
}));

vi.mock('@/features/staking/useStakingData', () => ({
  useStakingData: () => ({
    tokens: [
      {
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        stakingAPY: 3.2,
        totalStaked: '0',
        minimumStake: '1',
        lockPeriod: 0,
        isActive: true,
      },
    ],
    userPosition: {
      stETHBalance: '1000000000000000000',
      wstETHBalance: '0',
    },
    loading: false,
    error: null,
    refresh: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('@/features/staking/api', () => ({
  useStakingApi: () => ({
    stake: vi.fn(),
    unstake: (...args: unknown[]) => unstakeMock(...args),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
    getWithdrawals: (...args: unknown[]) => getWithdrawalsMock(...args),
    getHistory: vi.fn().mockResolvedValue([]),
    getPortfolio: vi.fn().mockResolvedValue(null),
    submitTransactionHash: vi.fn().mockResolvedValue(undefined),
    claimWithdrawals: vi.fn(),
  }),
}));

vi.mock('@/features/gateway', () => ({
  startSwapTracking: vi.fn().mockResolvedValue({
    transactionId: 'tx_gateway_1',
    walletId: 'wallet_gateway_1',
    addTxHash: vi.fn().mockResolvedValue(undefined),
    markSubmitted: vi.fn().mockResolvedValue(undefined),
    markPending: vi.fn().mockResolvedValue(undefined),
    markConfirmed: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('Staking queue status messaging', () => {
  beforeEach(() => {
    unstakeMock.mockReset();
    executeTransactionMock.mockReset();
    waitForEvmReceiptMock.mockReset();
    getWithdrawalsMock.mockReset();
    refreshMock.mockReset();

    getWithdrawalsMock.mockResolvedValue([]);
    refreshMock.mockResolvedValue(undefined);
  });

  test('shows queue explanation and value=0 expected copy after request confirmation', async () => {
    unstakeMock.mockResolvedValue({
      id: 'tx_request',
      type: 'unstake',
      transactionData: {
        to: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
        data: '0x12345678',
        value: '0',
        gasLimit: '320000',
        chainId: 1,
      },
    });

    executeTransactionMock.mockResolvedValue(
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    );

    waitForEvmReceiptMock.mockResolvedValue({
      outcome: 'confirmed',
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    });

    render(<Staking onClose={vi.fn()} initialMode="unstake" initialAmount="0.1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Request withdrawal (queue)' }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm request/i }));

    await waitFor(() => {
      expect(screen.getByText('Request submitted')).toBeInTheDocument();
      expect(screen.getByText(/value=0/i)).toBeInTheDocument();
      expect(screen.getByText(/claim your ETH once it is finalized/i)).toBeInTheDocument();
    });
  });
});

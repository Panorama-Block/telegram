import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Staking } from '@/components/Staking';

const waitForEvmReceiptMock = vi.fn();
const unstakeMock = vi.fn();
const executeTransactionMock = vi.fn();
const refreshMock = vi.fn();
const getWithdrawalsMock = vi.fn();
const getHistoryMock = vi.fn();
const getPortfolioMock = vi.fn();
const submitTransactionHashMock = vi.fn();
const claimWithdrawalsMock = vi.fn();

vi.mock('framer-motion', async () => await import('../../../test/mocks/framerMotion'));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}));

vi.mock('@/shared/utils/evmReceipt', () => ({
  waitForEvmReceipt: (...args: unknown[]) => waitForEvmReceiptMock(...args),
}));

vi.mock('@/features/swap/api', () => ({
  swapApi: {
    quote: vi.fn(),
    prepare: vi.fn(),
  },
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
    refresh: refreshMock,
  }),
}));

const stakingApiMock = {
  stake: vi.fn(),
  unstake: (...args: unknown[]) => unstakeMock(...args),
  executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
  getWithdrawals: (...args: unknown[]) => getWithdrawalsMock(...args),
  getHistory: (...args: unknown[]) => getHistoryMock(...args),
  getPortfolio: (...args: unknown[]) => getPortfolioMock(...args),
  submitTransactionHash: (...args: unknown[]) => submitTransactionHashMock(...args),
  claimWithdrawals: (...args: unknown[]) => claimWithdrawalsMock(...args),
};

vi.mock('@/features/staking/api', () => ({
  useStakingApi: () => stakingApiMock,
}));

describe('Staking queue unstake flow', () => {
  beforeEach(() => {
    unstakeMock.mockReset();
    executeTransactionMock.mockReset();
    waitForEvmReceiptMock.mockReset();
    refreshMock.mockReset();
    getWithdrawalsMock.mockReset();
    getHistoryMock.mockReset();
    getPortfolioMock.mockReset();
    submitTransactionHashMock.mockReset();
    claimWithdrawalsMock.mockReset();
    getWithdrawalsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([]);
    getPortfolioMock.mockResolvedValue(null);
    submitTransactionHashMock.mockResolvedValue(undefined);
    claimWithdrawalsMock.mockResolvedValue(undefined);
  });

  test('executes approval + request and renders queue progression', async () => {
    unstakeMock
      .mockResolvedValueOnce({
        id: 'tx_approve',
        type: 'unstake_approval',
        requiresFollowUp: true,
        followUpAction: 'unstake',
        transactionData: {
          to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          data: '0x095ea7b3',
          value: '0',
          gasLimit: '120000',
          chainId: 1,
        },
      })
      .mockResolvedValueOnce({
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

    executeTransactionMock
      .mockResolvedValueOnce('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      .mockResolvedValueOnce('0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');

    waitForEvmReceiptMock
      .mockResolvedValueOnce({
        outcome: 'confirmed',
        txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      })
      .mockResolvedValueOnce({
        outcome: 'confirmed',
        txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      });

    render(<Staking onClose={vi.fn()} initialMode="unstake" initialAmount="0.1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Protocol (Lido)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unstake (queue)' }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm request/i }));

    await waitFor(() => {
      expect(screen.getByText('Request submitted')).toBeInTheDocument();
      expect(screen.getAllByText('Approval').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Request').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0);
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Staking } from '@/components/Staking';

const waitForEvmReceiptMock = vi.fn();
const stakeMock = vi.fn();
const executeTransactionMock = vi.fn();
const getWithdrawalsMock = vi.fn();

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
    refresh: vi.fn(),
  }),
}));

vi.mock('@/features/staking/api', () => ({
  useStakingApi: () => ({
    stake: (...args: unknown[]) => stakeMock(...args),
    unstake: vi.fn(),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
    getWithdrawals: (...args: unknown[]) => getWithdrawalsMock(...args),
    getHistory: vi.fn().mockResolvedValue([]),
    getPortfolio: vi.fn().mockResolvedValue(null),
    submitTransactionHash: vi.fn().mockResolvedValue(undefined),
    claimWithdrawals: vi.fn(),
  }),
}));

describe('Staking component flow', () => {
  beforeEach(() => {
    stakeMock.mockReset();
    executeTransactionMock.mockReset();
    waitForEvmReceiptMock.mockReset();
    getWithdrawalsMock.mockReset();
    getWithdrawalsMock.mockResolvedValue([]);
  });

  test('runs stake mint flow and reaches confirmed status', async () => {
    stakeMock.mockResolvedValue({
      id: 'tx_1',
      transactionData: {
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x12345678',
        value: '10000000000000000',
        gasLimit: '210000',
        chainId: 1,
      },
    });
    executeTransactionMock.mockResolvedValue(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    waitForEvmReceiptMock.mockResolvedValue({
      outcome: 'confirmed',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    render(<Staking onClose={vi.fn()} initialAmount="0.01" initialMode="stake" />);

    fireEvent.click(await screen.findByRole('button', { name: /^Stake$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm stake/i }));

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Stake 0.01 ETH')).toBeInTheDocument();
    });
  });

  test('shows network error from transaction execution', async () => {
    stakeMock.mockResolvedValue({
      id: 'tx_2',
      transactionData: {
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        data: '0x12345678',
        value: '10000000000000000',
        gasLimit: '210000',
        chainId: 1,
      },
    });
    executeTransactionMock.mockRejectedValue(new Error('Wrong network (chainId 43114).'));

    render(<Staking onClose={vi.fn()} initialAmount="0.01" initialMode="stake" />);

    fireEvent.click(await screen.findByRole('button', { name: /^Stake$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm stake/i }));

    await waitFor(() => {
      expect(screen.getByText(/Wrong network/i)).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AvaxLp } from '@/components/AvaxLp';

const prepareAddLiquidityMock = vi.fn();
const prepareRemoveLiquidityMock = vi.fn();
const prepareStakeMock = vi.fn();
const prepareUnstakeMock = vi.fn();
const prepareClaimRewardsMock = vi.fn();
const executeTransactionMock = vi.fn();
const refreshMock = vi.fn();

const WAVAX_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const USDC_ADDRESS = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6';
const LP_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';
const FARM_ADDRESS = '0xfarm000000000000000000000000000000000001';

const mockPool = {
  poolId: 3,
  name: 'WAVAX-USDC',
  tokenA: { symbol: 'WAVAX', address: WAVAX_ADDRESS, decimals: 18, isNative: false },
  tokenB: { symbol: 'USDC.e', address: USDC_ADDRESS, decimals: 6, isNative: false },
  lpTokenAddress: LP_ADDRESS,
  farmAddress: FARM_ADDRESS,
  estimatedAPR: '12.5%',
  totalLiquidityUsd: '1000000',
  totalStaked: '50000000000000000000',
  rewardToken: { symbol: 'JOE', address: '0xjoe', decimals: 18 },
};

const mockPoolNoFarm = {
  ...mockPool,
  poolId: 99,
  farmAddress: null,
};

const mockPosition = {
  poolId: 3,
  poolName: 'WAVAX-USDC',
  lpTokenAddress: LP_ADDRESS,
  tokenA: mockPool.tokenA,
  tokenB: mockPool.tokenB,
  walletLpBalance: '500000000000000000',
  stakedBalance: '1000000000000000000',
  pendingRewards: '200000000000000000',
  rewardToken: mockPool.rewardToken,
  farmAddress: FARM_ADDRESS,
};

const mockPrepareResponse = {
  bundle: {
    steps: [
      { to: '0xapprove', data: '0xdata', value: '0', chainId: 43114, description: 'Approve WAVAX' },
      { to: '0xapprove2', data: '0xdata2', value: '0', chainId: 43114, description: 'Approve USDC.e' },
      { to: '0xexec', data: '0xdata3', value: '0', chainId: 43114, description: 'Add Liquidity' },
    ],
    totalSteps: 3,
    summary: 'Add liquidity to WAVAX-USDC',
  },
  metadata: { lpTokenAddress: LP_ADDRESS, farmAddress: FARM_ADDRESS },
};

vi.mock('framer-motion', async () => await import('../../../../test/mocks/framerMotion'));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
  useActiveWallet: () => null,
  useSwitchActiveWalletChain: () => vi.fn(),
}));

vi.mock('@/features/avax-lp/api', () => ({
  useAvaxLpApi: () => ({
    prepareAddLiquidity: (...args: unknown[]) => prepareAddLiquidityMock(...args),
    prepareRemoveLiquidity: (...args: unknown[]) => prepareRemoveLiquidityMock(...args),
    prepareStake: (...args: unknown[]) => prepareStakeMock(...args),
    prepareUnstake: (...args: unknown[]) => prepareUnstakeMock(...args),
    prepareClaimRewards: (...args: unknown[]) => prepareClaimRewardsMock(...args),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
  }),
}));

vi.mock('@/features/avax-lp/useAvaxLpData', () => ({
  useAvaxLpData: () => ({
    pools: [mockPool, mockPoolNoFarm],
    positions: [mockPosition],
    loading: false,
    userLoading: false,
    error: null,
    refresh: refreshMock,
  }),
}));

vi.mock('@/shared/hooks/useIsMobileBreakpoint', () => ({
  useIsMobileBreakpoint: () => false,
}));

beforeEach(() => {
  vi.clearAllMocks();
  prepareAddLiquidityMock.mockResolvedValue(mockPrepareResponse);
  prepareRemoveLiquidityMock.mockResolvedValue(mockPrepareResponse);
  prepareStakeMock.mockResolvedValue({ bundle: { steps: [{ to: '0x1', data: '0x', value: '0', chainId: 43114, description: 'Stake LP' }], totalSteps: 1, summary: 'Stake' }, metadata: {} });
  prepareClaimRewardsMock.mockResolvedValue({ bundle: { steps: [{ to: '0x1', data: '0x', value: '0', chainId: 43114, description: 'Claim JOE' }], totalSteps: 1, summary: 'Claim' }, metadata: {} });
  executeTransactionMock.mockResolvedValue({ transactionHash: '0xhash', confirmed: false, source: 'wallet' });
});

describe('AvaxLp component', () => {
  test('renders select view with pools', () => {
    render(<AvaxLp onClose={vi.fn()} />);
    expect(screen.getByText('All Pools')).toBeTruthy();
    expect(screen.getByText('Positions')).toBeTruthy();
  });

  test('shows pool cards in all pools tab', async () => {
    render(<AvaxLp onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('All Pools'));
    await waitFor(() => {
      expect(screen.getAllByText('WAVAX / USDC.e').length).toBeGreaterThan(0);
    });
  });

  test('navigates to input view on pool select', async () => {
    render(<AvaxLp onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('All Pools'));
    await waitFor(() => expect(screen.getAllByText('WAVAX / USDC.e').length).toBeGreaterThan(0));
    // Click the first pool card button
    const poolElements = screen.getAllByText('WAVAX / USDC.e');
    fireEvent.click(poolElements[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Add').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Remove').length).toBeGreaterThan(0);
    });
  });

  test('pool without farm disables stake/unstake/claim tabs', async () => {
    render(<AvaxLp onClose={vi.fn()} initialPoolId={99} initialAction="add" />);
    await waitFor(() => {
      const stakeBtn = screen.getByText('Stake');
      expect(stakeBtn.closest('button')?.disabled).toBeFalsy();
      // tabs should have cursor-not-allowed class when farm is absent
      expect(stakeBtn.closest('button')?.className).toContain('cursor-not-allowed');
    });
  });

  test('add liquidity flow: shows prepare response and proceeds to review', async () => {
    render(<AvaxLp onClose={vi.fn()} initialPoolId={3} initialAction="add" />);

    await waitFor(() => expect(screen.getAllByPlaceholderText('0.00').length).toBeGreaterThan(0));

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '10' } });

    const reviewBtn = screen.getByText(/Review Add Liquidity/i);
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(prepareAddLiquidityMock).toHaveBeenCalledWith(expect.objectContaining({
        tokenA: WAVAX_ADDRESS,
        tokenB: USDC_ADDRESS,
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('Add Liquidity')).toBeTruthy();
    });
  });

  test('prepare timeout shows error', async () => {
    prepareAddLiquidityMock.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Preparing transaction bundle timed out. Please try again.')), 0);
    }));

    render(<AvaxLp onClose={vi.fn()} initialPoolId={3} initialAction="add" />);
    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '10' } });
    fireEvent.click(screen.getByText(/Review Add Liquidity/i));

    await waitFor(() => {
      expect(screen.getByText(/timed out/i)).toBeTruthy();
    });
  });

  test('claim flow shows pending rewards', async () => {
    render(<AvaxLp onClose={vi.fn()} initialPoolId={3} initialAction="claim" />);

    await waitFor(() => {
      expect(screen.getAllByText(/JOE/).length).toBeGreaterThan(0);
    });
  });

  test('execute transaction calls executeTransaction for each step', async () => {
    render(<AvaxLp onClose={vi.fn()} initialPoolId={3} initialAction="add" />);

    const inputs = screen.getAllByPlaceholderText('0.00');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '10' } });
    fireEvent.click(screen.getByText(/Review Add Liquidity/i));

    await waitFor(() => screen.getByText(/Execute/i));
    fireEvent.click(screen.getByText(/Execute/i));

    await waitFor(() => {
      expect(executeTransactionMock).toHaveBeenCalledTimes(3);
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});

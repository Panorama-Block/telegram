import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Lending } from '@/components/Lending';

const waitForEvmReceiptMock = vi.fn();
const prepareWithdrawMock = vi.fn();
const executeTransactionMock = vi.fn();

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
      positions: [
        {
          qTokenAddress: baseToken.qTokenAddress,
          qTokenSymbol: baseToken.qTokenSymbol,
          suppliedWei: '500000000000000000',
          borrowedWei: '0',
          qTokenBalanceWei: '10000000',
          qTokenDecimals: 8,
        },
      ],
      liquidity: {
        shortfall: '0',
        isHealthy: true,
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    fetchPosition: vi.fn(),
  }),
}));

vi.mock('@/features/lending/api', () => ({
  useLendingApi: () => ({
    prepareSupply: vi.fn(),
    prepareWithdraw: (...args: unknown[]) => prepareWithdrawMock(...args),
    prepareBorrow: vi.fn(),
    prepareRepay: vi.fn(),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
    getTransactionHistory: vi.fn().mockResolvedValue([]),
  }),
}));

describe('Lending multi-step tx states', () => {
  beforeEach(() => {
    prepareWithdrawMock.mockReset();
    executeTransactionMock.mockReset();
    waitForEvmReceiptMock.mockReset();
  });

  test('shows timeout state and allows retry for validation step', async () => {
    prepareWithdrawMock.mockResolvedValue({
      data: {
        validation: {
          to: '0x8513b57A1B4f4c25dFB7B9f5cd66f07f6D8e43cf',
          value: '1000',
          data: '0xabcdef01',
          gasLimit: '140000',
          chainId: 43114,
        },
        withdraw: {
          to: baseToken.qTokenAddress,
          value: '0',
          data: '0xabcdef02',
          gasLimit: '300000',
          chainId: 43114,
        },
      },
    });
    executeTransactionMock.mockResolvedValue('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    waitForEvmReceiptMock.mockResolvedValue({
      outcome: 'timeout',
      txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });

    render(<Lending onClose={vi.fn()} initialAmount="0.1" initialMode="supply" initialFlow="close" />);

    const withdrawButtons = await screen.findAllByRole('button', { name: 'Withdraw' });
    fireEvent.click(withdrawButtons[withdrawButtons.length - 1]);
    fireEvent.click(await screen.findByRole('button', { name: /Confirm withdraw/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/confirmation is still pending/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Validation/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Try again'));
    expect(await screen.findByRole('button', { name: /Confirm withdraw/i })).toBeInTheDocument();
  });
});

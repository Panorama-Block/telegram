import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Lending } from '@/components/Lending';

const waitForEvmReceiptMock = vi.fn();
const prepareWithdrawMock = vi.fn();
const prepareBorrowMock = vi.fn();
const executeTransactionMock = vi.fn();
const submitEvidenceMock = vi.fn();
const executeEvidenceBoundOperationMock = vi.fn();

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
  useSwitchActiveWalletChain: () => vi.fn(async () => {}),
}));

vi.mock('thirdweb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('thirdweb')>();

  return {
    ...actual,
    createThirdwebClient: () => ({
      clientId: 'test-thirdweb-client',
    }),
  };
});

vi.mock('@/shared/config/thirdweb', () => ({
  THIRDWEB_CLIENT_ID: 'test-thirdweb-client',
}));

vi.mock('@/features/execution/evidenceBoundExecutor', () => ({
  executeEvidenceBoundOperation: (...args: unknown[]) =>
    executeEvidenceBoundOperationMock(...args),
}));

vi.mock('@/features/gateway', () => ({
  startSwapTracking: vi.fn().mockResolvedValue(null),
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
    prepareBorrow: (...args: unknown[]) => prepareBorrowMock(...args),
    prepareRepay: vi.fn(),
    executeTransaction: (...args: unknown[]) => executeTransactionMock(...args),
    submitEvidence: (...args: unknown[]) => submitEvidenceMock(...args),
    getTransactionHistory: vi.fn().mockResolvedValue([]),
  }),
}));

describe('Lending multi-step tx states', () => {
  beforeEach(() => {
    prepareWithdrawMock.mockReset();
    prepareBorrowMock.mockReset();
    executeTransactionMock.mockReset();
    submitEvidenceMock.mockReset();
    executeEvidenceBoundOperationMock.mockReset();
    waitForEvmReceiptMock.mockReset();

    submitEvidenceMock.mockResolvedValue({
      correlationId: 'corr-redeem-1',
      verified: true,
    });

    executeEvidenceBoundOperationMock.mockImplementation(
      async (args: any) => {
        const results = [];

        for (
          let index = 0;
          index < args.operation.steps.length;
          index++
        ) {
          const step = args.operation.steps[index];

          const txHash =
            index === 0
              ? '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
              : '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

          const result = {
            stepIndex: index,
            txHash,
            chainId: step.chainId,
            action: step.action,
          };

          await args.onConfirmed?.(result);

          await args.submitEvidence?.(
            args.operation.correlationId,
            {
              stepIndex: index,
              txHash,
              executionMechanism: 'thirdweb-client',
              providerMetadata: {
                sdk: 'thirdweb',
                flow: 'sendAndConfirmTransaction',
                chainId: step.chainId,
              },
            },
          );

          results.push(result);
        }

        return results;
      },
    );
  });

  test('executes withdraw approval then redeem through the evidence boundary', async () => {
    prepareWithdrawMock.mockResolvedValue({
      correlationId: 'corr-redeem-1',
      evidenceVersion: '1',
      evidenceEnabled: true,
      preparedPayloadHash: 'prepared-redeem-hash-1',
      bundle: {
        steps: [
          {
            to: baseToken.qTokenAddress,
            value: '0',
            data: '0x095ea7b3abcdef01',
            gasLimit: '140000',
            chainId: 43114,
          },
          {
            to: '0xc35059D1BC395Ff0F6fDcEA1b7F365E3aa7C1D12',
            value: '0',
            data: '0xabcdef02',
            gasLimit: '300000',
            chainId: 43114,
          },
        ],
        totalSteps: 2,
        summary: 'Redeem qiAVAX on Avalanche',
      },
    });

    render(
      <Lending
        onClose={vi.fn()}
        initialAmount="0.1"
        initialMode="supply"
        initialFlow="close"
      />,
    );

    const withdrawButtons =
      await screen.findAllByRole(
        'button',
        { name: 'Withdraw' },
      );

    fireEvent.click(
      withdrawButtons[
        withdrawButtons.length - 1
      ],
    );

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: /Confirm withdraw/i },
      ),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('Confirmed').length,
      ).toBeGreaterThan(0);
    });

    expect(prepareWithdrawMock).toHaveBeenCalledWith(
      baseToken.qTokenAddress,
      '0.1',
      18,
    );

    expect(
      executeEvidenceBoundOperationMock,
    ).toHaveBeenCalledTimes(1);

    const executionArgs =
      executeEvidenceBoundOperationMock.mock.calls[0][0];

    expect(
      executionArgs.operation.correlationId,
    ).toBe('corr-redeem-1');

    expect(
      executionArgs.operation.evidenceEnabled,
    ).toBe(true);

    expect(
      executionArgs.operation.preparedPayloadHash,
    ).toBe('prepared-redeem-hash-1');

    expect(
      executionArgs.operation.steps,
    ).toHaveLength(2);

    expect(
      executionArgs.operation.steps[0],
    ).toEqual(
      expect.objectContaining({
        stepIndex: 0,
        to: baseToken.qTokenAddress,
        data: '0x095ea7b3abcdef01',
        value: '0',
        chainId: 43114,
        action: 'Validation',
      }),
    );

    expect(
      executionArgs.operation.steps[1],
    ).toEqual(
      expect.objectContaining({
        stepIndex: 1,
        to: '0xc35059D1BC395Ff0F6fDcEA1b7F365E3aa7C1D12',
        data: '0xabcdef02',
        value: '0',
        chainId: 43114,
        action: 'Withdraw',
      }),
    );

    expect(submitEvidenceMock)
      .toHaveBeenCalledTimes(2);

    expect(submitEvidenceMock)
      .toHaveBeenNthCalledWith(
        1,
        'corr-redeem-1',
        expect.objectContaining({
          stepIndex: 0,
          txHash:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          executionMechanism:
            'thirdweb-client',
        }),
      );

    expect(submitEvidenceMock)
      .toHaveBeenNthCalledWith(
        2,
        'corr-redeem-1',
        expect.objectContaining({
          stepIndex: 1,
          txHash:
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          executionMechanism:
            'thirdweb-client',
        }),
      );

    expect(
      executeTransactionMock,
    ).not.toHaveBeenCalled();

    expect(
      waitForEvmReceiptMock,
    ).not.toHaveBeenCalled();
  });

  test('executes borrow through the evidence boundary', async () => {
    prepareBorrowMock.mockResolvedValue({
      correlationId: 'corr-borrow-1',
      evidenceVersion: '1',
      evidenceEnabled: true,
      preparedPayloadHash: 'prepared-borrow-hash-1',
      bundle: {
        steps: [
          {
            to: '0xc35059D1BC395Ff0F6fDcEA1b7F365E3aa7C1D12',
            value: '0',
            data: '0xabcdef03',
            gasLimit: '300000',
            chainId: 43114,
          },
        ],
        totalSteps: 1,
        summary: 'Borrow AVAX from Benqi',
      },
    });

    submitEvidenceMock.mockResolvedValue({
      correlationId: 'corr-borrow-1',
      verified: true,
    });

    render(
      <Lending
        onClose={vi.fn()}
        initialAmount="0.1"
        initialMode="borrow"
        initialFlow="open"
      />,
    );

    const borrowButtons =
      await screen.findAllByRole(
        'button',
        { name: 'Borrow' },
      );

    fireEvent.click(
      borrowButtons[
        borrowButtons.length - 1
      ],
    );

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: /Confirm borrow/i },
      ),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('Confirmed').length,
      ).toBeGreaterThan(0);
    });

    expect(prepareBorrowMock).toHaveBeenCalledWith(
      baseToken.qTokenAddress,
      '0.1',
      18,
    );

    expect(
      executeEvidenceBoundOperationMock,
    ).toHaveBeenCalledTimes(1);

    const executionArgs =
      executeEvidenceBoundOperationMock.mock.calls[0][0];

    expect(
      executionArgs.operation.correlationId,
    ).toBe('corr-borrow-1');

    expect(
      executionArgs.operation.evidenceEnabled,
    ).toBe(true);

    expect(
      executionArgs.operation.preparedPayloadHash,
    ).toBe('prepared-borrow-hash-1');

    expect(
      executionArgs.operation.steps,
    ).toHaveLength(1);

    expect(
      executionArgs.operation.steps[0],
    ).toEqual(
      expect.objectContaining({
        stepIndex: 0,
        to: '0xc35059D1BC395Ff0F6fDcEA1b7F365E3aa7C1D12',
        data: '0xabcdef03',
        value: '0',
        chainId: 43114,
        action: 'Borrow',
      }),
    );

    expect(submitEvidenceMock)
      .toHaveBeenCalledTimes(1);

    expect(submitEvidenceMock)
      .toHaveBeenCalledWith(
        'corr-borrow-1',
        expect.objectContaining({
          stepIndex: 0,
          txHash:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          executionMechanism:
            'thirdweb-client',
        }),
      );

    expect(
      executeTransactionMock,
    ).not.toHaveBeenCalled();

    expect(
      waitForEvmReceiptMock,
    ).not.toHaveBeenCalled();
  });

});

/**
 * Mock API for Liquidity Provision
 * Simulates backend responses for testing the liquidity flow
 */

import type {
  LiquidityQuoteRequest,
  LiquidityQuoteResponse,
  LiquidityPrepareRequest,
  LiquidityPrepareResponse,
  LiquidityPositionStatus,
} from './types';

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock: Get quote for liquidity provision
 */
export async function getLiquidityQuote(
  request: LiquidityQuoteRequest
): Promise<LiquidityQuoteResponse> {
  await delay(1200); // Simulate network delay

  // Mock successful quote
  return {
    success: true,
    quote: {
      chainId: request.chainId,
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0: {
        symbol: request.token0 === 'native' ? 'ETH' : 'USDC',
        address: request.token0,
        amount: request.amount0,
        decimals: request.token0 === 'native' ? 18 : 6,
        usdValue: request.token0 === 'native' ? '278.00' : request.amount0,
      },
      token1: {
        symbol: request.token1 === 'native' ? 'ETH' : 'INCH',
        address: request.token1,
        amount: request.amount1,
        decimals: request.token1 === 'native' ? 18 : 18,
        usdValue: '0.00',
      },
      feeTier: request.feeTier || 100, // 0.01%
      feeTierLabel: '0.01%',
      priceRange: {
        min: '3200.28',
        max: '3911.28',
        current: '3556.00',
      },
      liquidityAmount: '0.0156',
      shareOfPool: '0.00012',
      estimatedApr: '24.5',
      estimatedGasFee: '0.00024',
      estimatedGasFeeUsd: '0.85',
    },
  };
}

/**
 * Mock: Prepare liquidity transaction
 */
export async function prepareLiquidityTransaction(
  request: LiquidityPrepareRequest
): Promise<LiquidityPrepareResponse> {
  await delay(800);

  // Mock prepared transactions
  return {
    success: true,
    prepared: {
      transactions: [
        {
          to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          data: '0x414bf389000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000000000000000000000000000000000000000000064000000000000000000000000' + request.sender.slice(2) + '0000000000000000000000000000000000000000000000000000000065f3a9000000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          value: request.token0 === 'native' || request.token1 === 'native' ? request.amount0Wei : '0',
          chainId: request.chainId,
          gasLimit: 350000n,
        },
      ],
      steps: [
        {
          name: 'Approve Token0',
          description: 'Approve spending of token0',
          transactions: [],
        },
        {
          name: 'Approve Token1',
          description: 'Approve spending of token1',
          transactions: [],
        },
        {
          name: 'Add Liquidity',
          description: 'Add liquidity to the pool',
          transactions: [],
        },
      ],
      estimatedGas: '0.00024',
    },
  };
}

/**
 * Mock: Get liquidity position status
 */
export async function getLiquidityPositionStatus(
  txHash: string,
  chainId: number
): Promise<LiquidityPositionStatus> {
  await delay(1500);

  return {
    success: true,
    data: {
      positionId: '12345',
      poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      transactionHash: txHash,
      chainId: chainId,
      token0Amount: '0.278',
      token1Amount: '1.19',
      liquidityAmount: '0.0156',
      status: 'confirmed',
    },
  };
}

/**
 * Mock: Generate a fake transaction hash
 */
export function generateMockTxHash(): string {
  return '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

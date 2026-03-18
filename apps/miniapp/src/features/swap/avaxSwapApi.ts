// API client para swap same-chain na Avalanche via Execution Layer (TraderJoe)

const WAVAX = '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7';

// O frontend normaliza AVAX nativo para 0xeeee... — o backend espera WAVAX
function toBackendToken(addr: string): string {
  const a = addr.toLowerCase();
  if (a === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || a === '0x0000000000000000000000000000000000000000') {
    return WAVAX;
  }
  return a;
}

export interface AvaxSwapPrepareParams {
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // wei string
  slippageBps?: number;
}

export async function prepareAvaxSwap(params: AvaxSwapPrepareParams) {
  const res = await fetch('/api/yield/avax/swap/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: params.userAddress,
      tokenIn: toBackendToken(params.tokenIn),
      tokenOut: toBackendToken(params.tokenOut),
      amountIn: params.amountIn,
      slippageBps: params.slippageBps ?? 50,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`avax-swap prepare failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{
    bundle: { steps: Array<{ transactions: Array<{ to: string; data: string; value: string; chainId: number }> }> };
    metadata: { amountOut: string; amountOutMin: string; swapType: string };
  }>;
}

import { getTokenBySymbol, isChainSupported } from '../config/tokens.js';
import { API_CONFIG, ENDPOINTS } from '../config/api.js';

export interface QuoteRequest {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amount: string;
  smartAccountAddress: string;
}

export interface QuoteResponse {
  quote: {
    estimatedReceiveAmount: string;
    estimatedReceiveAmountUsd: string;
    fees: {
      totalFeeUsd: string;
    };
    exchangeRate: number;
    estimatedDuration: number;
  };
}

export class QuoteService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.SWAP_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getQuote(
    fromChainId: number,
    toChainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    authToken: string
  ): Promise<QuoteResponse> {
    console.log('📊 [QUOTE] Getting quote...', { 
      fromChainId, 
      toChainId, 
      fromToken, 
      toToken, 
      amount 
    });

    // Validate chains
    if (!isChainSupported(fromChainId)) {
      throw new Error(`Chain ${fromChainId} not supported`);
    }
    if (!isChainSupported(toChainId)) {
      throw new Error(`Chain ${toChainId} not supported`);
    }

    // Get token data
    const fromTokenData = getTokenBySymbol(fromChainId, fromToken);
    const toTokenData = getTokenBySymbol(toChainId, toToken);

    if (!fromTokenData) {
      throw new Error(`Token ${fromToken} not found on chain ${fromChainId}`);
    }
    if (!toTokenData) {
      throw new Error(`Token ${toToken} not found on chain ${toChainId}`);
    }

    const requestBody: QuoteRequest = {
      fromChainId,
      toChainId,
      fromToken: fromTokenData.address,
      toToken: toTokenData.address,
      amount,
      smartAccountAddress: '0x0000000000000000000000000000000000000000' // Placeholder for bot
    };

    console.log('📊 [QUOTE] Request Body:', requestBody);

    const response = await fetch(`${this.baseUrl}${ENDPOINTS.QUOTE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get quote: ${response.status} - ${errorText}`);
    }

    const quoteData = await response.json() as QuoteResponse;
    console.log('📊 [QUOTE] Success:', quoteData);
    return quoteData;
  }
}

// Export singleton instance
export const quoteService = new QuoteService();

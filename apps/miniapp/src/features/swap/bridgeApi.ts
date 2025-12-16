import { QuoteResponse, PrepareResponse } from './types';

// Resolve bridge API base from env to allow tunneling/proxy configuration
const BRIDGE_SERVICE_URL =
    (process.env.NEXT_PUBLIC_BRIDGE_API_BASE || '').replace(/\/+$/, '') ||
    'http://localhost:3006/api/bridge';

export const bridgeApi = {
    async quote(amount: number): Promise<QuoteResponse> {
        const response = await fetch(`${BRIDGE_SERVICE_URL}/quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
            throw new Error('Failed to get bridge quote');
        }

        const data = await response.json();
        return {
            success: true,
            quote: data.data,
        };
    },

    async createTransaction(amount: number, destinationAddress: string, sourceAddress?: string): Promise<any> {
        const response = await fetch(`${BRIDGE_SERVICE_URL}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount, destinationAddress, sourceAddress }),
        });

        if (!response.ok) {
            throw new Error('Failed to create bridge transaction');
        }

        const data = await response.json();
        return data.data;
    },

    async getStatus(swapId: string): Promise<any> {
        const response = await fetch(`${BRIDGE_SERVICE_URL}/transaction/${encodeURIComponent(swapId)}`);
        if (!response.ok) {
            throw new Error('Failed to get bridge status');
        }
        const data = await response.json();
        return data.data;
    },
};

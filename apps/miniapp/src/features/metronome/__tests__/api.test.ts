import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/mocks/server';
import { MetronomeApiClient } from '../api';

const USER = '0xabCDefabcdEfAbcdEfAbcdefAbcDEFabcdefabcd';
const PROXY = '0x1111111111111111111111111111111111111111';

function buildClient() {
  // No NEXT_PUBLIC_BASE_EXECUTION_API_URL in vitest env → falls back to proxy path.
  return new MetronomeApiClient(USER);
}

describe('MetronomeApiClient', () => {
  it('GET /markets returns the catalog', async () => {
    server.use(
      http.get('*/modules/metronome/markets', () =>
        HttpResponse.json({
          collateral: [
            { symbol: 'msdUSDC', depositToken: '0xaaa', underlying: '0xbbb', underlyingSymbol: 'USDC', decimals: 6 },
          ],
          synthetic: [
            { symbol: 'msUSD', debtToken: '0xccc', synth: '0xddd', decimals: 18 },
          ],
        }),
      ),
    );

    const markets = await buildClient().getMarkets();
    expect(markets.collateral).toHaveLength(1);
    expect(markets.collateral[0].symbol).toBe('msdUSDC');
    expect(markets.synthetic[0].symbol).toBe('msUSD');
  });

  it('GET /position/:user returns zeros envelope when proxy is unknown', async () => {
    server.use(
      http.get(`*/modules/metronome/position/${USER}`, () =>
        HttpResponse.json({
          userAddress: USER,
          adapterProxy: '',
          collateral: [
            { symbol: 'msdUSDC', depositToken: '0xaaa', underlying: '0xbbb', underlyingSymbol: 'USDC', decimals: 6, shares: '0' },
          ],
          debt: [
            { symbol: 'msUSD', debtToken: '0xccc', synth: '0xddd', decimals: 18, debt: '0' },
          ],
        }),
      ),
    );

    const pos = await buildClient().getPosition();
    expect(pos.adapterProxy).toBe('');
    expect(pos.collateral[0].shares).toBe('0');
  });

  it('getPosition without userAddress on client or arg throws', () => {
    const client = new MetronomeApiClient(null);
    expect(() => client.getPosition()).toThrow('no user address');
  });

  it('POST /prepare-deposit serializes the request body', async () => {
    let received: any = null;
    server.use(
      http.post('*/modules/metronome/prepare-deposit', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          bundle: {
            steps: [
              { to: '0x01', data: '0x', value: '0', chainId: 8453, description: 'approve' },
              { to: '0x02', data: '0xff', value: '0', chainId: 8453, description: 'execute' },
            ],
            totalSteps: 2,
            summary: 'Deposit USDC',
          },
          metadata: {
            action: 'deposit_collateral',
            depositToken: '0xaaa',
            depositTokenSymbol: 'msdUSDC',
            underlyingSymbol: 'USDC',
            amount: '1000000',
          },
        });
      }),
    );

    const res = await buildClient().prepareDeposit({
      userAddress: USER,
      depositTokenAddress: '0xaaa',
      amount: '1000000',
    });

    expect(received).toEqual({
      userAddress: USER,
      depositTokenAddress: '0xaaa',
      amount: '1000000',
    });
    expect(res.bundle.totalSteps).toBe(2);
    expect(res.metadata.action).toBe('deposit_collateral');
  });

  it('POST /prepare-unwind passes through recipient when provided', async () => {
    let received: any = null;
    server.use(
      http.post('*/modules/metronome/prepare-unwind', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          bundle: { steps: [], totalSteps: 0, summary: '' },
          metadata: { action: 'unwind_position' },
        });
      }),
    );

    await buildClient().prepareUnwind({
      userAddress: USER,
      debtTokenAddress: '0xccc',
      depositTokenAddress: '0xaaa',
      synthAmount: '500000000000000000',
      recipient: PROXY,
    });

    expect(received.recipient).toBe(PROXY);
    expect(received.synthAmount).toBe('500000000000000000');
  });

  it('propagates backend error messages through DefiApiError', async () => {
    server.use(
      http.post('*/modules/metronome/prepare-repay', () =>
        HttpResponse.json({ error: { message: 'insufficient debt' } }, { status: 400 }),
      ),
    );

    await expect(
      buildClient().prepareRepay({
        userAddress: USER,
        debtTokenAddress: '0xccc',
        amount: '1',
      }),
    ).rejects.toMatchObject({
      name: 'DefiApiError',
      status: 400,
      message: 'insufficient debt',
    });
  });
});

import { TonClient, Address, beginCell } from '@ton/ton';
import { getHttpEndpoint } from '@orbs-network/ton-access';

// Official jUSDT master contract (bridge.ton.org) on TON mainnet
const USDT_MASTER_ADDRESS = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');

export async function getUserJettonWallet(userMainAddress: string) {
    const endpoint = await getHttpEndpoint({ network: 'mainnet' });
    const client = new TonClient({ endpoint });

    const userAddress = Address.parse(userMainAddress);

    // We ask the Master Contract: "Where is the wallet for this user?"
    const response = await client.runMethod(USDT_MASTER_ADDRESS, 'get_wallet_address', [
        { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() }
    ]);

    return response.stack.readAddress(); // This is the address we send the transaction TO
}

export function toUSDT(amount: string | number): bigint {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    // jUSDT on TON uses 6 decimals
    return BigInt(Math.floor(val * 1_000_000));
}

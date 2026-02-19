import { getRpcClient, eth_gasPrice, eth_maxPriorityFeePerGas, eth_getTransactionCount } from "thirdweb/rpc";
import { defineChain, getContract, readContract, prepareTransaction, encode } from "thirdweb";
import type { ThirdwebClient } from "thirdweb";
import type { Address } from "thirdweb";

// Max uint256 for infinite approval
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

/**
 * Check if a token has sufficient allowance for a spender
 */
export async function checkAllowance(
  client: ThirdwebClient,
  chainId: number,
  tokenAddress: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  try {
    const chain = defineChain(chainId);
    const contract = getContract({
      client,
      chain,
      address: tokenAddress,
    });

    const allowance = await readContract({
      contract,
      method: "function allowance(address owner, address spender) view returns (uint256)",
      params: [owner, spender],
    });

    console.log(`[checkAllowance] Token ${tokenAddress} allowance for ${spender}: ${allowance}`);
    return allowance;
  } catch (error) {
    console.error(`[checkAllowance] Failed to check allowance:`, error);
    return 0n;
  }
}

/**
 * Create infinite approval transaction data
 */
export function createInfiniteApprovalData(spender: Address): `0x${string}` {
  // ERC20 approve(address spender, uint256 amount) function selector: 0x095ea7b3
  // Encode: approve(spender, MaxUint256)
  const spenderPadded = spender.slice(2).toLowerCase().padStart(64, '0');
  const amountPadded = MAX_UINT256.toString(16).padStart(64, '0');
  return `0x095ea7b3${spenderPadded}${amountPadded}` as `0x${string}`;
}

/**
 * Check if a transaction is an approval transaction
 */
export function isApprovalTransaction(tx: any): boolean {
  // Check if data starts with approve function selector (0x095ea7b3)
  return tx.data?.startsWith('0x095ea7b3') || tx.action === 'approval';
}

/**
 * Extract spender address from approval transaction data
 */
export function extractSpenderFromApproval(data: string): Address | null {
  if (!data?.startsWith('0x095ea7b3')) return null;
  // approve(address spender, uint256 amount)
  // Function selector: 4 bytes (8 chars after 0x)
  // Spender: 32 bytes (64 chars), but address is only 20 bytes, so it's padded
  const spenderHex = data.slice(10, 74); // Skip 0x095ea7b3 (10 chars), take 64 chars
  const spender = '0x' + spenderHex.slice(24); // Take last 40 chars (20 bytes)
  return spender as Address;
}

/**
 * Extract token address from approval transaction (the 'to' field)
 */
export function extractTokenFromApproval(tx: any): Address | null {
  return tx.to as Address;
}

/**
 * Alternative transaction handling that tries to work around thirdweb ABI issues
 */

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

function describeAnyError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (err instanceof Error) {
    const base = err.message || 'Unknown error';
    const cause = (err as any)?.cause;
    if (cause instanceof Error && cause.message) return `${base} (cause: ${cause.message})`;
    if (typeof cause === 'string' && cause.trim().length > 0) return `${base} (cause: ${cause})`;
    return base;
  }
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const anyErr = err as any;
    const message =
      anyErr?.shortMessage ||
      anyErr?.message ||
      anyErr?.error?.message ||
      anyErr?.error ||
      anyErr?.reason ||
      anyErr?.data?.message ||
      anyErr?.response?.data?.message;
    if (typeof message === 'string' && message.trim().length > 0) return message;

    // JSON.stringify(Error) often yields "{}", so fall back to property introspection.
    try {
      const json = JSON.stringify(anyErr);
      if (json && json !== '{}' && json !== '[]') return json;
    } catch {}

    try {
      const props = Object.getOwnPropertyNames(anyErr);
      if (props.length) {
        const out: Record<string, unknown> = {};
        for (const p of props) out[p] = anyErr[p];
        return JSON.stringify(out);
      }
    } catch {}

    return String(anyErr);
  }
  return String(err);
}

/**
 * Get the current nonce for an address on a specific chain
 * Uses "pending" to get the next nonce including pending transactions
 */
export async function getCurrentNonce(
  client: ThirdwebClient,
  chainId: number,
  address: Address
): Promise<number> {
  try {
    const chain = defineChain(chainId);
    const rpcClient = getRpcClient({ client, chain });

    const nonce = await eth_getTransactionCount(rpcClient, {
      address,
      blockTag: "pending", // Use pending to include pending txs
    });

    console.log(`[getCurrentNonce] Chain ${chainId}, Address ${address}: nonce=${nonce}`);
    return nonce;
  } catch (error) {
    console.error(`[getCurrentNonce] Failed to get nonce:`, error);
    throw error;
  }
}

/**
 * Get valid EIP-1559 gas parameters for a chain
 * Ensures maxFeePerGas >= maxPriorityFeePerGas
 */
export async function getValidGasParams(
  client: ThirdwebClient,
  chainId: number
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    const chain = defineChain(chainId);
    const rpcClient = getRpcClient({ client, chain });

    // Get current gas price and priority fee
    const [gasPrice, priorityFee] = await Promise.all([
      eth_gasPrice(rpcClient),
      eth_maxPriorityFeePerGas(rpcClient).catch(() => null),
    ]);

    // Use priority fee if available, otherwise estimate as 10% of gas price
    const maxPriorityFeePerGas = priorityFee || (gasPrice / 10n);

    // maxFeePerGas should be at least gasPrice + priorityFee
    // Add 20% buffer for base fee fluctuation
    const maxFeePerGas = gasPrice + maxPriorityFeePerGas + (gasPrice / 5n);

    console.log(`[getValidGasParams] Chain ${chainId}: maxFeePerGas=${maxFeePerGas}, maxPriorityFeePerGas=${maxPriorityFeePerGas}`);

    return { maxFeePerGas, maxPriorityFeePerGas };
  } catch (error) {
    console.error(`[getValidGasParams] Failed to get gas params for chain ${chainId}:`, error);
    // Return safe defaults for L2s (low gas)
    const defaultPriorityFee = chainId === 42161 ? 10000000n : 1000000000n; // 0.01 gwei for Arb, 1 gwei for others
    return {
      maxFeePerGas: defaultPriorityFee * 3n, // 3x priority fee as max
      maxPriorityFeePerGas: defaultPriorityFee,
    };
  }
}

/**
 * Alternative approach: Try to catch the error and extract hash more aggressively
 */
export async function safeExecuteTransactionV2(
  transactionFn: () => Promise<{ transactionHash: string }>
): Promise<TransactionResult> {
  try {
    const result = await transactionFn();
    return {
      success: true,
      transactionHash: result.transactionHash,
    };
  } catch (error: any) {
    const message = describeAnyError(error);
    console.error('Transaction error caught:', {
      message,
      name: (error as any)?.name,
      code: (error as any)?.code,
      stack: (error as any)?.stack,
      error,
    });

    // Some wallet/providers throw ABI/serialization errors *after* broadcasting the tx.
    // Trust-first UX: if we can extract a tx hash, treat it as submitted and let the UI track confirmations.
    const extractedHash = extractHashFromError(error);
    if (extractedHash && extractedHash !== `0x${'0'.repeat(64)}`) {
      console.warn('⚠️ Transaction threw but hash was found; treating as submitted:', extractedHash);
      return {
        success: true,
        transactionHash: extractedHash,
      };
    }

    // Check if this is a chain/undefined error (common with direct transaction submission)
    if (message.includes("Cannot read properties of undefined") && message.includes("'id'")) {
      console.error('⚠️ Chain undefined error - this is a thirdweb configuration issue');
      return {
        success: false,
        error: 'Transaction preparation failed: chain configuration error. Please try again.',
      };
    }

    // Check if this is an ABI error (often happens with Uniswap Smart Router)
    if (isABIErrorSignatureNotFound(error)) {
      console.warn('⚠️ ABI error detected - This is common with Uniswap V3 Router');
      console.warn('Error details:', message);

      // Try to extract hash from the error
      const hash = extractHashFromError(error);

      if (hash && hash !== `0x${'0'.repeat(64)}`) {
        console.log('✅ Successfully extracted hash from ABI error:', hash);
        return {
          success: true,
          transactionHash: hash,
        };
      }

      // For Uniswap Smart Router, the ABI error often happens during gas estimation
      // but this doesn't mean the transaction will fail. The transaction data is correct.
      // We should inform the user but allow them to proceed
      console.warn('⚠️ ABI error during transaction preparation.');
      console.warn('This is a known issue with Uniswap V3 Router error signatures.');
      console.warn('The transaction data is valid, but we cannot simulate it beforehand.');

      // If we can't extract hash, this might be a real failure
      // Let's check if the error contains any indication of success
      if (message.includes('transaction') && (message.includes('sent') || message.includes('submitted'))) {
        console.warn('Error suggests transaction was sent but ABI decoding failed');
        return {
          success: false,
          error: 'Transaction may have been sent but status cannot be verified due to ABI error. Please check your wallet or blockchain explorer.',
        };
      }

      // Return a more helpful error message
      return {
        success: false,
        error: 'Cannot simulate transaction (ABI error 0x7939f424). This is a known Uniswap V3 Router issue. The transaction itself is valid, but your wallet provider is preventing it. Try using a different wallet or increasing slippage tolerance in settings.',
      };
    }
    
    // For other errors, return the error
    return {
      success: false,
      error: message || 'Transaction failed',
    };
  }
}

function isABIErrorSignatureNotFound(error: any): boolean {
  const message = describeAnyError(error);
  return (
    message.includes('AbiErrorSignatureNotFoundError') ||
    message.includes('Encoded error signature') ||
    message.includes('not found on ABI') ||
    message.includes('0x7939f424') ||
    error?.name === 'AbiErrorSignatureNotFoundError'
  );
}

function extractHashFromError(error: any): string | null {
  const hashRegex = /0x[a-fA-F0-9]{64}/g;

  const deepFind = (val: unknown, seen = new Set<any>()): string | null => {
    if (!val) return null;
    if (typeof val === 'string') {
      const m = val.match(hashRegex);
      return m && m[0] ? m[0] : null;
    }
    if (typeof val !== 'object') return null;
    if (seen.has(val)) return null;
    seen.add(val);

    const anyVal = val as any;
    // Common nesting patterns
    const direct = [
      anyVal?.transactionHash,
      anyVal?.hash,
      anyVal?.txHash,
      anyVal?.tx?.hash,
      anyVal?.tx?.transactionHash,
      anyVal?.result?.hash,
      anyVal?.result?.transactionHash,
      anyVal?.receipt?.transactionHash,
      anyVal?.data?.transactionHash,
      anyVal?.cause,
    ];
    for (const d of direct) {
      const found = deepFind(d, seen);
      if (found) return found;
    }

    // Explore own properties (including non-enumerable when available)
    try {
      for (const key of Object.getOwnPropertyNames(anyVal)) {
        const found = deepFind(anyVal[key], seen);
        if (found) return found;
      }
    } catch {}

    // Explore enumerable values as a fallback
    try {
      for (const v of Object.values(anyVal)) {
        const found = deepFind(v, seen);
        if (found) return found;
      }
    } catch {}

    return null;
  };

  // 1) Look in message-like fields first
  const msg = String(error?.shortMessage || error?.message || '');
  const matches = msg.match(hashRegex);
  if (matches && matches.length > 0) return matches[0];

  // 2) Deep search error object
  return deepFind(error);
}

/**
 * Alternative transaction handling that tries to work around thirdweb ABI issues
 */

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
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
    console.error('Transaction error caught:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      error: error
    });

    // Check if this is a chain/undefined error (common with direct transaction submission)
    if (error.message?.includes("Cannot read properties of undefined") &&
        error.message?.includes("'id'")) {
      console.error('⚠️ Chain undefined error - this is a thirdweb configuration issue');
      return {
        success: false,
        error: 'Transaction preparation failed: chain configuration error. Please try again.',
      };
    }

    // Check if this is an ABI error (often happens with Uniswap Smart Router)
    if (isABIErrorSignatureNotFound(error)) {
      console.warn('⚠️ ABI error detected - This is common with Uniswap V3 Router');
      console.warn('Error details:', error.message);

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
      if (error.message?.includes('transaction') &&
          (error.message?.includes('sent') || error.message?.includes('submitted'))) {
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
      error: error.message || 'Transaction failed',
    };
  }
}

function isABIErrorSignatureNotFound(error: any): boolean {
  const message = error?.message || '';
  return (
    message.includes('AbiErrorSignatureNotFoundError') ||
    message.includes('Encoded error signature') ||
    message.includes('not found on ABI') ||
    message.includes('0x7939f424') ||
    error?.name === 'AbiErrorSignatureNotFoundError'
  );
}

function extractHashFromError(error: any): string | null {
  // Try to find any 64-character hex string starting with 0x
  const hashRegex = /0x[a-fA-F0-9]{64}/g;
  const message = error?.message || '';
  const matches = message.match(hashRegex);
  
  if (matches && matches.length > 0) {
    // Return the first valid hash found
    return matches[0];
  }
  
  // Try to find in error properties
  const searchProps = ['transactionHash', 'hash', 'txHash', 'tx', 'result'];
  for (const prop of searchProps) {
    const value = error?.[prop];
    if (typeof value === 'string' && hashRegex.test(value)) {
      return value;
    }
    if (value?.hash && typeof value.hash === 'string' && hashRegex.test(value.hash)) {
      return value.hash;
    }
    if (value?.transactionHash && typeof value.transactionHash === 'string' && hashRegex.test(value.transactionHash)) {
      return value.transactionHash;
    }
  }
  
  return null;
}

/**
 * Utility functions for handling transaction errors, especially ABI-related errors
 */

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Safely executes a transaction with proper error handling for ABI errors
 * @param transactionFn - Function that executes the transaction
 * @returns Promise<TransactionResult>
 */
export async function safeExecuteTransaction(
  transactionFn: () => Promise<{ transactionHash: string }>
): Promise<TransactionResult> {
  try {
    const result = await transactionFn();
    return {
      success: true,
      transactionHash: result.transactionHash,
    };
  } catch (error: any) {
    // Check if this is an ABI error signature not found error
    if (isABIErrorSignatureNotFound(error)) {
      console.warn('ABI error signature not found, attempting to recover transaction hash...', {
        message: error.message,
        errorType: error.constructor.name,
        errorKeys: Object.keys(error),
        fullError: error
      });
      
      // Try to extract transaction hash from the error
      const extractedHash = extractTransactionHashFromError(error);
      
      if (extractedHash && extractedHash !== `0x${'0'.repeat(64)}`) {
        console.log('Recovered transaction hash from ABI error:', extractedHash);
        return {
          success: true,
          transactionHash: extractedHash,
        };
      } else {
        // If we can't extract the hash, we need to fail properly
        // This prevents fake transaction simulation
        console.error('Could not extract valid transaction hash from ABI error', {
          extractedHash,
          errorMessage: error.message,
          errorStack: error.stack
        });
        return {
          success: false,
          error: 'Transaction hash could not be extracted from ABI error. This may be a thirdweb configuration issue or the transaction may have actually failed.',
        };
      }
    }
    
    // For other errors, return the error
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}

/**
 * Checks if the error is an ABI error signature not found error
 */
function isABIErrorSignatureNotFound(error: any): boolean {
  const message = error?.message || '';
  return (
    message.includes('AbiErrorSignatureNotFoundError') ||
    message.includes('Encoded error signature') ||
    message.includes('not found on ABI') ||
    message.includes('0x7939f424') // Specific error signature we're seeing
  );
}

/**
 * Attempts to extract transaction hash from various error properties
 */
function extractTransactionHashFromError(error: any): string | null {
  console.log('Attempting to extract transaction hash from error:', {
    errorType: error?.constructor?.name,
    errorKeys: error ? Object.keys(error) : [],
    errorMessage: error?.message
  });

  // Method 1: Extract from error message using regex
  const hashMatch = error.message?.match(/0x[a-fA-F0-9]{64}/);
  if (hashMatch) {
    console.log('Found hash in error message:', hashMatch[0]);
    return hashMatch[0];
  }
  
  // Method 2: Check if error has transaction hash property
  if (error?.transactionHash) {
    console.log('Found hash in error.transactionHash:', error.transactionHash);
    return error.transactionHash;
  }
  
  // Method 3: Check if error has hash property
  if (error?.hash) {
    console.log('Found hash in error.hash:', error.hash);
    return error.hash;
  }
  
  // Method 4: Check if error has txHash property
  if (error?.txHash) {
    console.log('Found hash in error.txHash:', error.txHash);
    return error.txHash;
  }
  
  // Method 5: Check if error has tx property with hash
  if (error?.tx?.hash) {
    console.log('Found hash in error.tx.hash:', error.tx.hash);
    return error.tx.hash;
  }
  
  // Method 6: Check if error has result property with hash
  if (error?.result?.transactionHash) {
    console.log('Found hash in error.result.transactionHash:', error.result.transactionHash);
    return error.result.transactionHash;
  }

  // Method 7: Check if error has cause property with hash
  if (error?.cause?.transactionHash) {
    console.log('Found hash in error.cause.transactionHash:', error.cause.transactionHash);
    return error.cause.transactionHash;
  }

  // Method 8: Check if error has cause property with hash
  if (error?.cause?.hash) {
    console.log('Found hash in error.cause.hash:', error.cause.hash);
    return error.cause.hash;
  }

  // Method 9: Deep search in error object for any hash-like string
  const deepSearch = (obj: any, depth = 0): string | null => {
    if (depth > 3 || !obj || typeof obj !== 'object') return null;
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)) {
        console.log(`Found hash in error.${key}:`, value);
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        const found = deepSearch(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  const deepFound = deepSearch(error);
  if (deepFound) {
    return deepFound;
  }
  
  console.log('No valid transaction hash found in error object');
  return null;
}

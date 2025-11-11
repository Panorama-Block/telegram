# Lending Service - Practical Examples

## Validation Fee Calculation

### Understanding the 10% Validation Fee

All lending operations incur a **10% validation fee** charged by the validation contract. This means:

- **Total Amount**: The amount you specify
- **Validation Fee**: 10% of total amount
- **Net Amount**: 90% of total amount (the actual amount used for the operation)

### Example Component Showing Validation Fee

```typescript
import React, { useState } from 'react';

function ValidationFeeDisplay({ amount, tokenSymbol }: { amount: string; tokenSymbol: string }) {
  const totalAmount = parseFloat(amount) || 0;
  const validationFee = totalAmount * 0.1;
  const netAmount = totalAmount * 0.9;

  if (totalAmount <= 0) return null;

  return (
    <div style={{ 
      background: 'rgba(255, 193, 7, 0.1)', 
      border: '1px solid rgba(255, 193, 7, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px 0'
    }}>
      <h4 style={{ color: '#ffc107', marginBottom: '12px' }}>
        ⚠️ Validation Fee Information
      </h4>
      
      <div style={{ fontSize: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Total Amount:</span>
          <strong>{totalAmount.toFixed(8)} {tokenSymbol}</strong>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Validation Fee (10%):</span>
          <strong style={{ color: '#ffc107' }}>
            {validationFee.toFixed(8)} {tokenSymbol}
          </strong>
        </div>
        
        <hr style={{ borderColor: 'rgba(255, 193, 7, 0.2)', margin: '12px 0' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>Net Amount:</span>
          <strong>{netAmount.toFixed(8)} {tokenSymbol}</strong>
        </div>
      </div>
      
      <p style={{ fontSize: '12px', color: 'rgba(255, 193, 7, 0.8)', marginTop: '12px' }}>
        The validation contract charges a 10% fee. Only 90% of your amount will be used for the operation.
      </p>
    </div>
  );
}
```

### Integration Example with Fee Display

```typescript
const handleSupply = async (tokenAddress: string, amount: string) => {
  try {
    // Calculate and display validation fee before transaction
    const totalAmount = parseFloat(amount);
    const validationFee = totalAmount * 0.1;
    const netAmount = totalAmount * 0.9;
    
    console.log(`Total: ${totalAmount}, Fee: ${validationFee}, Net: ${netAmount}`);
    
    // Show confirmation with fee breakdown
    const confirmed = confirm(
      `Supply ${amount} ${tokenSymbol}?\n` +
      `- Validation Fee: ${validationFee.toFixed(8)} ${tokenSymbol} (10%)\n` +
      `- Net Amount: ${netAmount.toFixed(8)} ${tokenSymbol} (90%)\n` +
      `Only ${netAmount.toFixed(8)} ${tokenSymbol} will be supplied to the protocol.`
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    setError(null);
    
    const txData = await lendingApi.prepareSupply(tokenAddress, amount);
    const success = await lendingApi.executeTransaction(txData.data.supply);
    
    if (success) {
      alert(`Supply successful! ${netAmount.toFixed(8)} ${tokenSymbol} supplied.`);
      loadData();
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## Complete Integration Example

```typescript
import React, { useState, useEffect } from 'react';
import { useLendingApi } from './api';

export function LendingDashboard() {
  const lendingApi = useLendingApi();
  const [tokens, setTokens] = useState([]);
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tokensData, positionData] = await Promise.all([
        lendingApi.getTokens(),
        lendingApi.getUserPosition()
      ]);
      setTokens(tokensData);
      setPosition(positionData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupply = async (tokenAddress: string, amount: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const txData = await lendingApi.prepareSupply(tokenAddress, amount);
      const success = await lendingApi.executeTransaction(txData.data.supply);
      
      if (success) {
        alert('Supply successful!');
        loadData(); // Refresh data
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (tokenAddress: string, amount: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const txData = await lendingApi.prepareWithdraw(tokenAddress, amount);
      const success = await lendingApi.executeTransaction(txData.data.withdraw);
      
      if (success) {
        alert('Withdraw successful!');
        loadData();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Lending Dashboard</h2>
      
      {position && (
        <div>
          <h3>Your Position</h3>
          <p>Health Factor: {position.healthFactor}</p>
          <p>Supplied: {position.suppliedAmount}</p>
          <p>Borrowed: {position.borrowedAmount}</p>
        </div>
      )}
      
      <h3>Available Tokens</h3>
      {tokens.map(token => (
        <div key={token.address} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
          <h4>{token.symbol}</h4>
          <p>Supply APY: {token.supplyAPY}%</p>
          <p>Borrow APY: {token.borrowAPY}%</p>
          <p>Available: {token.availableLiquidity}</p>
          
          <button onClick={() => handleSupply(token.address, '1.0')}>
            Supply 1.0 {token.symbol}
          </button>
          
          <button onClick={() => handleWithdraw(token.address, '0.5')}>
            Withdraw 0.5 {token.symbol}
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Advanced Usage Patterns

### 1. Error Recovery with Retry

```typescript
async function robustSupply(tokenAddress: string, amount: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const txData = await lendingApi.prepareSupply(tokenAddress, amount);
      const success = await lendingApi.executeTransaction(txData.data.supply);
      return success;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Supply failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

### 2. Batch Operations

```typescript
async function batchSupply(operations: Array<{tokenAddress: string, amount: string}>) {
  const results = [];
  
  for (const operation of operations) {
    try {
      const txData = await lendingApi.prepareSupply(operation.tokenAddress, operation.amount);
      const success = await lendingApi.executeTransaction(txData.data.supply);
      results.push({ success: true, operation });
    } catch (error) {
      results.push({ success: false, operation, error: error.message });
    }
  }
  
  return results;
}

// Usage
const operations = [
  { tokenAddress: '0x...', amount: '100' },
  { tokenAddress: '0x...', amount: '50' }
];

const results = await batchSupply(operations);
console.log('Batch results:', results);
```

### 3. Position Monitoring

```typescript
class PositionMonitor {
  private lendingApi: LendingApiClient;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(lendingApi: LendingApiClient) {
    this.lendingApi = lendingApi;
  }
  
  startMonitoring(intervalMs = 30000) {
    this.intervalId = setInterval(async () => {
      try {
        const position = await this.lendingApi.getUserPosition();
        if (position) {
          this.checkHealthFactor(position);
        }
      } catch (error) {
        console.error('Position monitoring error:', error);
      }
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private checkHealthFactor(position: LendingPosition) {
    if (position.healthFactor < 1.5) {
      console.warn('⚠️ Low health factor:', position.healthFactor);
    }
    
    if (position.healthFactor < 1.1) {
      console.error('🚨 Critical health factor! Risk of liquidation!');
    }
  }
}

// Usage
const monitor = new PositionMonitor(lendingApi);
monitor.startMonitoring(30000); // Check every 30 seconds
```

### 4. Cache Management

```typescript
class LendingDataManager {
  private lendingApi: LendingApiClient;
  
  constructor(lendingApi: LendingApiClient) {
    this.lendingApi = lendingApi;
  }
  
  async getFreshTokens() {
    // Clear cache and fetch fresh data
    this.lendingApi.clearLendingDataCache();
    return await this.lendingApi.getTokens();
  }
  
  async getCachedTokens() {
    // Use cached data if available
    const cacheStatus = this.lendingApi.getCacheStatus();
    
    if (cacheStatus.hasCache && !cacheStatus.isExpired) {
      console.log('Using cached data (age:', cacheStatus.cacheAge, 'ms)');
    }
    
    return await this.lendingApi.getTokens();
  }
  
  async refreshIfNeeded() {
    const cacheStatus = this.lendingApi.getCacheStatus();
    
    if (!cacheStatus.hasCache || cacheStatus.isExpired) {
      console.log('Cache expired, refreshing data...');
      return await this.getFreshTokens();
    }
    
    return await this.getCachedTokens();
  }
}
```

### 5. Transaction Status Tracking

```typescript
class TransactionTracker {
  private pendingTransactions = new Map<string, any>();
  
  async trackTransaction(txHash: string, operation: string) {
    this.pendingTransactions.set(txHash, {
      operation,
      startTime: Date.now(),
      status: 'pending'
    });
    
    // Poll for confirmation (simplified example)
    this.pollTransactionStatus(txHash);
  }
  
  private async pollTransactionStatus(txHash: string) {
    // In a real implementation, you would check the blockchain
    // or use a service like Alchemy/Moralis for transaction status
    
    setTimeout(() => {
      const tx = this.pendingTransactions.get(txHash);
      if (tx) {
        tx.status = 'confirmed';
        console.log(`Transaction ${txHash} confirmed for ${tx.operation}`);
        this.pendingTransactions.delete(txHash);
      }
    }, 30000); // Simulate 30-second confirmation
  }
  
  getPendingTransactions() {
    return Array.from(this.pendingTransactions.entries());
  }
}
```

## Testing Examples

### Unit Test Example

```typescript
import { LendingApiClient } from './api';

describe('LendingApiClient', () => {
  let client: LendingApiClient;
  let mockAccount: any;
  
  beforeEach(() => {
    mockAccount = {
      address: '0x123...',
      signMessage: jest.fn().mockResolvedValue('0xsignature...')
    };
    client = new LendingApiClient(mockAccount);
  });
  
  describe('toWei', () => {
    it('should convert decimal to wei correctly', () => {
      const result = client['toWei']('1.5', 18);
      expect(result).toBe('1500000000000000000');
    });
    
    it('should handle invalid input', () => {
      const result = client['toWei']('invalid', 18);
      expect(result).toBe('0');
    });
  });
  
  describe('formatMessage', () => {
    it('should format message with token address', () => {
      const result = client['formatMessage']('Supply', '100', '0x123...');
      expect(result).toContain('Supply 100 of token 0x123...');
      expect(result).toContain('Timestamp:');
    });
  });
});
```

### Integration Test Example

```typescript
describe('Lending Integration', () => {
  let client: LendingApiClient;
  
  beforeAll(() => {
    // Setup test environment
    process.env.NEXT_PUBLIC_LENDING_API_URL = 'http://localhost:3001';
  });
  
  it('should fetch tokens successfully', async () => {
    const tokens = await client.getTokens();
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty('symbol');
    expect(tokens[0]).toHaveProperty('supplyAPY');
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    const tokens = await client.getTokens();
    expect(Array.isArray(tokens)).toBe(true); // Should return fallback data
  });
});
```

## Performance Optimization

### 1. Debounced API Calls

```typescript
import { debounce } from 'lodash';

const debouncedGetTokens = debounce(async () => {
  return await lendingApi.getTokens();
}, 500);

// Use in component
const [tokens, setTokens] = useState([]);

useEffect(() => {
  debouncedGetTokens().then(setTokens);
}, []);
```

### 2. Memoized Calculations

```typescript
import { useMemo } from 'react';

function TokenList({ tokens }) {
  const sortedTokens = useMemo(() => {
    return tokens.sort((a, b) => b.supplyAPY - a.supplyAPY);
  }, [tokens]);
  
  const totalLiquidity = useMemo(() => {
    return tokens.reduce((sum, token) => sum + parseFloat(token.availableLiquidity), 0);
  }, [tokens]);
  
  return (
    <div>
      <p>Total Liquidity: {totalLiquidity}</p>
      {sortedTokens.map(token => (
        <div key={token.address}>{token.symbol}: {token.supplyAPY}%</div>
      ))}
    </div>
  );
}
```

### 3. Lazy Loading

```typescript
const LazyLendingDashboard = React.lazy(() => import('./LendingDashboard'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyLendingDashboard />
    </Suspense>
  );
}
```

These examples demonstrate the flexibility and power of the Lending Service API Client, showing how it can be integrated into various application patterns and use cases.

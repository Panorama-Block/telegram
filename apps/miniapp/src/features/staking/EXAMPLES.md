# Liquid Staking Service - Practical Examples

## BigInt Handling

### Understanding BigInt in Staking Transactions

Staking transactions involve large numbers (values in wei) that exceed JavaScript's safe integer limit. The staking service properly handles BigInt conversion for:

- **Transaction Values**: ETH amounts in wei (e.g., 1000000000000000000 for 1 ETH)
- **Gas Limits**: Large gas values that may exceed Number.MAX_SAFE_INTEGER
- **Hex Conversion**: Automatic conversion between decimal strings and hex format

### Example: Proper Value Conversion

```typescript
// The executeTransaction method automatically handles BigInt conversion
const txData = {
  to: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  value: "1000000000000000000", // 1 ETH in wei (as string)
  data: "0x...",
  gasLimit: "200000"
};

// This will properly convert to hex:
// value: "0xde0b6b3a7640000"
// gasLimit: "0x30d40"
const txHash = await stakingApi.executeTransaction(txData);
```

### Handling Large Numbers

```typescript
// ✅ Correct: Use string for large numbers
const amount = "1000000000000000000000"; // 1000 ETH in wei
const txData = await stakingApi.stake(amount);

// ❌ Incorrect: Don't use JavaScript numbers for large values
const amount = 1000000000000000000000; // Will lose precision!
```

## Complete Integration Example

```typescript
import React, { useState, useEffect } from 'react';
import { useStakingApi } from './api';

export function StakingDashboard() {
  const stakingApi = useStakingApi();
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
        stakingApi.getTokens(),
        stakingApi.getUserPosition()
      ]);
      setTokens(tokensData);
      setPosition(positionData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async (amount: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const transaction = await stakingApi.stake(amount);
      
      if (transaction.transactionData) {
        const txHash = await stakingApi.executeTransaction(transaction.transactionData);
        console.log('Staking successful!', txHash);
        alert(`Staking successful! Transaction: ${txHash}`);
        loadData(); // Refresh data
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (amount: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const transaction = await stakingApi.unstake(amount);
      
      if (transaction.transactionData) {
        const txHash = await stakingApi.executeTransaction(transaction.transactionData);
        console.log('Unstaking successful!', txHash);
        alert(`Unstaking successful! Transaction: ${txHash}`);
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
      <h2>Staking Dashboard</h2>
      
      {position && (
        <div>
          <h3>Your Position</h3>
          <p>Staked: {position.stakedAmount}</p>
          <p>stETH Balance: {position.stETHBalance}</p>
          <p>Rewards: {position.rewards}</p>
          <p>APY: {position.apy}%</p>
        </div>
      )}
      
      <h3>Available Tokens</h3>
      {tokens.map(token => (
        <div key={token.address} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
          <h4>{token.symbol}</h4>
          <p>Staking APY: {token.stakingAPY}%</p>
          <p>Total Staked: {token.totalStaked}</p>
          
          <button onClick={() => handleStake('1.0')}>
            Stake 1.0 {token.symbol}
          </button>
          
          <button onClick={() => handleUnstake('0.5')}>
            Unstake 0.5 stETH
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
async function robustStake(amount: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transaction = await stakingApi.stake(amount);
      
      if (transaction.transactionData) {
        const txHash = await stakingApi.executeTransaction(transaction.transactionData);
        return txHash;
      }
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Staking failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

### 2. Balance Checking Before Unstaking

```typescript
async function safeUnstake(amount: string, account: any) {
  // Check stETH balance first
  const stETHAddress = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
  
  // Get balance (you'll need to implement getTokenBalance or use a library)
  const balance = await getTokenBalance(account, stETHAddress);
  const amountInWei = parseFloat(amount) * 1e18;
  
  if (parseFloat(balance) < amountInWei) {
    throw new Error(`Insufficient stETH balance. You have ${balance} but trying to unstake ${amountInWei}`);
  }
  
  // Proceed with unstaking
  const transaction = await stakingApi.unstake(amount);
  
  if (transaction.transactionData) {
    return await stakingApi.executeTransaction(transaction.transactionData);
  }
}
```

### 3. Position Monitoring

```typescript
class StakingPositionMonitor {
  private stakingApi: StakingApiClient;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(stakingApi: StakingApiClient) {
    this.stakingApi = stakingApi;
  }
  
  startMonitoring(intervalMs = 60000) {
    this.intervalId = setInterval(async () => {
      try {
        const position = await this.stakingApi.getUserPosition();
        if (position) {
          this.checkPosition(position);
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
  
  private checkPosition(position: StakingPosition) {
    const stakedAmount = parseFloat(position.stakedAmount) / 1e18;
    const rewards = parseFloat(position.rewards) / 1e18;
    const apy = position.apy;
    
    console.log(`📊 Position Update:`);
    console.log(`   Staked: ${stakedAmount.toFixed(4)} ETH`);
    console.log(`   Rewards: ${rewards.toFixed(4)} ETH`);
    console.log(`   APY: ${apy.toFixed(2)}%`);
    
    // Calculate estimated annual rewards
    const estimatedAnnualRewards = stakedAmount * (apy / 100);
    console.log(`   Estimated Annual Rewards: ${estimatedAnnualRewards.toFixed(4)} ETH`);
  }
}

// Usage
const monitor = new StakingPositionMonitor(stakingApi);
monitor.startMonitoring(60000); // Check every minute
```

### 4. Cache Management

```typescript
class StakingDataManager {
  private stakingApi: StakingApiClient;
  
  constructor(stakingApi: StakingApiClient) {
    this.stakingApi = stakingApi;
  }
  
  async getFreshTokens() {
    // Clear cache and fetch fresh data
    this.stakingApi.clearLidoDataCache();
    return await this.stakingApi.getTokens();
  }
  
  async getCachedTokens() {
    // Use cached data if available
    const cacheStatus = this.stakingApi.getCacheStatus();
    
    if (cacheStatus.hasCache && !cacheStatus.isExpired) {
      console.log('Using cached data (age:', cacheStatus.cacheAge, 'ms)');
    }
    
    return await this.stakingApi.getTokens();
  }
  
  async refreshIfNeeded() {
    const cacheStatus = this.stakingApi.getCacheStatus();
    
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
class StakingTransactionTracker {
  private pendingTransactions = new Map<string, any>();
  
  async trackTransaction(txHash: string, operation: string) {
    this.pendingTransactions.set(txHash, {
      operation,
      startTime: Date.now(),
      status: 'pending'
    });
    
    // Poll for confirmation
    this.pollTransactionStatus(txHash);
  }
  
  private async pollTransactionStatus(txHash: string) {
    // In a real implementation, you would check the blockchain
    // or use a service like Etherscan/Alchemy for transaction status
    
    const checkInterval = setInterval(async () => {
      try {
        // Check transaction status (simplified example)
        const response = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=YOUR_API_KEY`);
        const data = await response.json();
        
        if (data.result && data.result.status === '0x1') {
          const tx = this.pendingTransactions.get(txHash);
          if (tx) {
            tx.status = 'confirmed';
            console.log(`✅ Transaction ${txHash} confirmed for ${tx.operation}`);
            this.pendingTransactions.delete(txHash);
            clearInterval(checkInterval);
          }
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
      }
    }, 10000); // Check every 10 seconds
    
    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      const tx = this.pendingTransactions.get(txHash);
      if (tx && tx.status === 'pending') {
        console.warn(`⚠️ Transaction ${txHash} still pending after 5 minutes`);
      }
    }, 300000);
  }
  
  getPendingTransactions() {
    return Array.from(this.pendingTransactions.entries());
  }
}

// Usage
const tracker = new StakingTransactionTracker();

const handleStake = async (amount: string) => {
  const transaction = await stakingApi.stake(amount);
  if (transaction.transactionData) {
    const txHash = await stakingApi.executeTransaction(transaction.transactionData);
    await tracker.trackTransaction(txHash, 'stake');
  }
};
```

### 6. Amount Formatting Utilities

```typescript
// Convert ETH to wei (as string to avoid precision loss)
function ethToWei(eth: string): string {
  const ethNum = parseFloat(eth);
  if (isNaN(ethNum)) return '0';
  return (ethNum * 1e18).toString();
}

// Convert wei to ETH
function weiToEth(wei: string): string {
  const weiNum = parseFloat(wei);
  if (isNaN(weiNum)) return '0';
  return (weiNum / 1e18).toFixed(6);
}

// Format amount for display
function formatAmount(amount: string, decimals: number = 18): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  if (isNaN(num) || !isFinite(num)) return '0.00';
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });
}

// Usage
const amountInWei = ethToWei('1.5'); // "1500000000000000000"
const amountInEth = weiToEth('1500000000000000000'); // "1.500000"
const formatted = formatAmount('1500000000000000000', 18); // "1.500000"
```

## Testing Examples

### Unit Test Example

```typescript
import { StakingApiClient } from './api';

describe('StakingApiClient', () => {
  let client: StakingApiClient;
  let mockAccount: any;
  
  beforeEach(() => {
    mockAccount = {
      address: '0x123...',
      signMessage: jest.fn().mockResolvedValue('0xsignature...'),
      sendTransaction: jest.fn().mockResolvedValue({ transactionHash: '0xtxhash...' })
    };
    client = new StakingApiClient(mockAccount);
  });
  
  describe('executeTransaction', () => {
    it('should handle BigInt values correctly', async () => {
      const txData = {
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        value: '1000000000000000000', // 1 ETH in wei
        data: '0x...',
        gasLimit: '200000'
      };
      
      const txHash = await client.executeTransaction(txData);
      
      expect(mockAccount.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.stringMatching(/^0x[a-fA-F0-9]+$/),
          gasLimit: expect.stringMatching(/^0x[a-fA-F0-9]+$/)
        })
      );
      expect(txHash).toBe('0xtxhash...');
    });
    
    it('should handle hex values correctly', async () => {
      const txData = {
        to: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        value: '0xde0b6b3a7640000', // Already in hex
        data: '0x...',
        gasLimit: '0x30d40'
      };
      
      await client.executeTransaction(txData);
      
      expect(mockAccount.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '0xde0b6b3a7640000',
          gasLimit: '0x30d40'
        })
      );
    });
  });
});
```

### Integration Test Example

```typescript
describe('Staking Integration', () => {
  let client: StakingApiClient;
  
  beforeAll(() => {
    // Setup test environment
    process.env.NEXT_PUBLIC_STAKING_API_URL = 'http://localhost:3004';
  });
  
  it('should fetch tokens successfully', async () => {
    const tokens = await client.getTokens();
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty('symbol');
    expect(tokens[0]).toHaveProperty('stakingAPY');
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    // Should use fallback data
    const tokens = await client.getTokens();
    expect(Array.isArray(tokens)).toBe(true);
  });
});
```

## Performance Optimization

### 1. Debounced API Calls

```typescript
import { debounce } from 'lodash';

const debouncedGetTokens = debounce(async () => {
  return await stakingApi.getTokens();
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
    return tokens.sort((a, b) => b.stakingAPY - a.stakingAPY);
  }, [tokens]);
  
  const totalStaked = useMemo(() => {
    return tokens.reduce((sum, token) => {
      return sum + parseFloat(token.totalStaked) / 1e18;
    }, 0);
  }, [tokens]);
  
  return (
    <div>
      <p>Total Staked: {totalStaked.toFixed(2)} ETH</p>
      {sortedTokens.map(token => (
        <div key={token.address}>
          {token.symbol}: {token.stakingAPY}% APY
        </div>
      ))}
    </div>
  );
}
```

### 3. Lazy Loading

```typescript
const LazyStakingDashboard = React.lazy(() => import('./StakingDashboard'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyStakingDashboard />
    </Suspense>
  );
}
```

## BigInt Conversion Examples

### Converting Decimal to Hex

```typescript
// Manual conversion example (for reference)
function decimalToHex(decimal: string): string {
  const bigIntValue = BigInt(decimal);
  return `0x${bigIntValue.toString(16)}`;
}

// Examples
decimalToHex('1000000000000000000'); // "0xde0b6b3a7640000" (1 ETH)
decimalToHex('200000'); // "0x30d40" (gas limit)
```

### Converting Hex to Decimal

```typescript
function hexToDecimal(hex: string): string {
  // Remove 0x prefix if present
  const hexValue = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt(`0x${hexValue}`).toString();
}

// Examples
hexToDecimal('0xde0b6b3a7640000'); // "1000000000000000000"
hexToDecimal('0x30d40'); // "200000"
```

### Validating Transaction Values

```typescript
function validateTransactionValue(value: string): boolean {
  try {
    // Check if it's already hex
    if (value.startsWith('0x')) {
      // Validate hex format
      return /^0x[a-fA-F0-9]+$/i.test(value);
    } else {
      // Validate decimal format and convert to BigInt
      const bigIntValue = BigInt(value);
      // Check if value is positive
      return bigIntValue >= 0n;
    }
  } catch {
    return false;
  }
}

// Usage
validateTransactionValue('1000000000000000000'); // true
validateTransactionValue('0xde0b6b3a7640000'); // true
validateTransactionValue('-100'); // false
validateTransactionValue('invalid'); // false
```

These examples demonstrate the flexibility and power of the Liquid Staking Service API Client, showing how it can be integrated into various application patterns and use cases, with special attention to BigInt handling for large transaction values.


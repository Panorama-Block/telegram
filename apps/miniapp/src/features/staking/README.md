# Liquid Staking Service API Client

## Overview

The Liquid Staking Service API Client provides a comprehensive interface for interacting with liquid staking protocols, specifically Lido on Ethereum. It handles token management, position tracking, transaction preparation, and execution for staking operations.

## Features

- **Token Management**: Fetch available staking tokens (ETH, stETH, wstETH) with real-time APY data from Lido Protocol
- **Position Tracking**: Monitor user staking positions, stETH/wstETH balances, and accumulated rewards
- **Transaction Preparation**: Prepare stake and unstake transactions
- **Smart Wallet Integration**: Full support for smart wallet authentication and signing
- **Caching**: Intelligent caching to prevent API overuse and improve performance
- **Error Handling**: Robust error handling with fallback mechanisms
- **BigInt Support**: Proper handling of large numbers in transaction values and gas limits

## Protocol Information

### Lido Protocol

Lido is a liquid staking protocol for Ethereum that allows users to stake ETH and receive stETH (staked ETH) tokens in return. These tokens represent staked ETH and accrue staking rewards over time.

**Key Features:**
- **No Lock Period**: Unlike traditional staking, Lido allows immediate unstaking
- **Liquid Tokens**: stETH and wstETH are tradeable and can be used in DeFi
- **Automatic Rewards**: Rewards are automatically compounded into your stETH balance
- **Ethereum Mainnet**: Operates on Ethereum Mainnet (Chain ID: 1)

### Supported Tokens

1. **ETH** (Native Ethereum)
   - Address: `0x0000000000000000000000000000000000000000`
   - Minimum Stake: 1 ETH
   - Decimals: 18

2. **stETH** (Staked ETH)
   - Address: `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
   - Minimum Stake: 0.001 ETH
   - Decimals: 18
   - Receives staking rewards automatically

3. **wstETH** (Wrapped Staked ETH)
   - Address: `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`
   - Minimum Stake: 0.001 ETH
   - Decimals: 18
   - ERC20-compatible version of stETH

## Architecture

### Core Components

1. **StakingApiClient**: Main service class handling all API interactions
2. **Type Definitions**: Comprehensive TypeScript interfaces for type safety
3. **Authentication**: JWT-based authentication with smart wallet signing
4. **Caching Layer**: 5-minute cache for Lido protocol data to prevent rate limiting

### Data Flow

```
Frontend → StakingApiClient → Backend API → Lido Protocol
    ↓              ↓              ↓
Smart Wallet → JWT Auth → Ethereum Mainnet
```

## API Reference

### Core Methods

#### `getTokens(): Promise<StakingToken[]>`

Fetches available staking tokens with current market data from Lido Protocol.

**Returns:**
- Array of `StakingToken` objects with APY, total staked, and minimum stake amounts

**Features:**
- 5-minute intelligent caching
- Direct integration with Lido API
- Fallback data on API failure
- Automatic retry with timeout protection

**Example:**
```typescript
const tokens = await stakingApi.getTokens();
console.log(tokens[0].stakingAPY); // 4.2
console.log(tokens[0].symbol); // "ETH"
```

#### `getUserPosition(): Promise<StakingPosition | null>`

Retrieves the user's current staking position.

**Returns:**
- `StakingPosition` object with staked amount, stETH/wstETH balances, and rewards
- `null` if no position exists

**Example:**
```typescript
const position = await stakingApi.getUserPosition();
if (position) {
  console.log(`Staked: ${position.stakedAmount}`);
  console.log(`stETH Balance: ${position.stETHBalance}`);
  console.log(`Rewards: ${position.rewards}`);
  console.log(`APY: ${position.apy}%`);
}
```

### Transaction Methods

#### `stake(amount: string): Promise<StakingTransaction>`

Prepares a stake transaction for converting ETH to stETH.

**Parameters:**
- `amount`: Amount of ETH to stake (as decimal string, e.g., "1.5")

**Returns:**
- `StakingTransaction` object with transaction data ready for execution

**Process:**
1. Validates amount is positive
2. Authenticates with backend
3. Prepares transaction data
4. Returns transaction ready for execution

**Example:**
```typescript
const transaction = await stakingApi.stake("1.5");
if (transaction.transactionData) {
  const txHash = await stakingApi.executeTransaction(transaction.transactionData);
  console.log('Staking successful:', txHash);
}
```

#### `unstake(amount: string): Promise<StakingTransaction>`

Prepares an unstake transaction for converting stETH back to ETH.

**Parameters:**
- `amount`: Amount of stETH to unstake (as decimal string, e.g., "1.5")

**Returns:**
- `StakingTransaction` object with transaction data ready for execution

**Note:** Requires sufficient stETH balance. The transaction will fail if balance is insufficient.

**Example:**
```typescript
const transaction = await stakingApi.unstake("1.5");
if (transaction.transactionData) {
  const txHash = await stakingApi.executeTransaction(transaction.transactionData);
  console.log('Unstaking successful:', txHash);
}
```

### Execution Method

#### `executeTransaction(txData: any): Promise<string>`

Executes a prepared transaction on the blockchain using the connected wallet.

**Parameters:**
- `txData`: Transaction data from stake/unstake methods
  - `to`: Contract address
  - `value`: Transaction value in wei (as string or hex)
  - `data`: Transaction data (hex string)
  - `gasLimit`: Gas limit (as string or hex)

**Returns:**
- Transaction hash (hex string)

**Features:**
- Automatic BigInt handling for large values
- Gas price estimation from Etherscan
- Proper hex conversion for all numeric values
- Transaction validation before submission

**BigInt Handling:**
The method properly handles:
- Decimal strings (e.g., "1000000000000000000")
- Hex strings (e.g., "0xde0b6b3a7640000")
- Large numbers that exceed JavaScript's safe integer limit
- Automatic conversion to hex format required by Ethereum

**Example:**
```typescript
const txHash = await stakingApi.executeTransaction({
  to: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  value: "1000000000000000000", // 1 ETH in wei
  data: "0x...",
  gasLimit: "200000"
});
console.log('Transaction hash:', txHash);
```

### Utility Methods

#### `clearLidoDataCache(): void`

Clears the Lido protocol data cache (useful for testing or manual refresh).

#### `getCacheStatus(): { hasCache: boolean; cacheAge: number; isExpired: boolean }`

Returns current cache status for debugging.

## Type Definitions

### StakingToken

```typescript
interface StakingToken {
  symbol: string;              // Token symbol (e.g., "ETH", "stETH", "wstETH")
  address: string;             // Contract address
  icon?: string;               // Optional icon URL
  decimals: number;            // Token decimals (18 for all)
  stakingAPY: number;           // Staking APY (%)
  totalStaked: string;         // Total staked amount
  totalRewards: string;        // Total rewards distributed
  minimumStake: string;         // Minimum stake amount in wei
  lockPeriod: number;          // Lock period in days (0 for Lido)
  isActive: boolean;           // Whether staking is active
}
```

### StakingPosition

```typescript
interface StakingPosition {
  id: string;                  // Position ID
  userAddress: string;         // User wallet address
  stakedAmount: string;        // Total staked amount in wei
  stETHBalance: string;        // Current stETH balance in wei
  wstETHBalance: string;       // Current wstETH balance in wei
  rewards: string;             // Accumulated rewards in wei
  apy: number;                 // Current APY (%)
  timestamp: string;            // Position creation timestamp
  status: 'active' | 'inactive'; // Position status
}
```

### StakingTransaction

```typescript
interface StakingTransaction {
  id: string;                  // Transaction ID
  userAddress: string;         // User wallet address
  type: 'stake' | 'unstake' | 'claim'; // Transaction type
  amount: string;              // Amount in wei
  token: string;               // Token symbol
  status: 'pending' | 'completed' | 'failed'; // Transaction status
  timestamp: string;           // Transaction timestamp
  transactionData?: {          // Transaction data for execution
    to: string;                // Contract address
    data: string;              // Transaction data (hex)
    value: string;             // Value in wei
    gasLimit: string;          // Gas limit
    chainId: number;           // Chain ID (1 for Ethereum Mainnet)
  };
}
```

## Authentication

The client uses JWT-based authentication with smart wallet signing:

1. **Message Generation**: Creates timestamped messages for each operation
2. **Smart Wallet Signing**: Uses connected wallet to sign messages
3. **JWT Token**: Backend validates signature and returns JWT token
4. **Token Persistence**: Tokens stored in localStorage for session persistence
5. **Automatic Renewal**: Handles token refresh automatically

### Message Format

```
{Action description} {amount} {token}
Timestamp: {timestamp}
```

**Examples:**
- `Stake 1.5 ETH\nTimestamp: 1234567890`
- `Unstake 1.5 stETH\nTimestamp: 1234567890`
- `Get staking position\nTimestamp: 1234567890`

## Error Handling

The client implements comprehensive error handling:

- **Network Errors**: Automatic retry with timeout protection
- **API Errors**: Detailed error messages with status codes
- **Validation Errors**: Input validation with helpful messages
- **Authentication Errors**: Automatic re-authentication on token expiry
- **Fallback Data**: Uses cached data when Lido API is unavailable

## Usage Examples

### Basic Setup

```typescript
import { useStakingApi } from '@/features/staking/api';

function StakingComponent() {
  const stakingApi = useStakingApi();
  
  // Fetch tokens
  const [tokens, setTokens] = useState([]);
  
  useEffect(() => {
    stakingApi.getTokens().then(setTokens);
  }, []);
  
  return (
    <div>
      {tokens.map(token => (
        <div key={token.address}>
          {token.symbol}: {token.stakingAPY}% APY
        </div>
      ))}
    </div>
  );
}
```

### Stake Transaction

```typescript
async function handleStake(amount: string) {
  try {
    // Prepare transaction
    const transaction = await stakingApi.stake(amount);
    
    // Execute transaction if transactionData is available
    if (transaction.transactionData) {
      const txHash = await stakingApi.executeTransaction(transaction.transactionData);
      console.log('Staking successful!', txHash);
    }
  } catch (error) {
    console.error('Staking failed:', error.message);
  }
}
```

### Unstake Transaction

```typescript
async function handleUnstake(amount: string) {
  try {
    const transaction = await stakingApi.unstake(amount);
    
    if (transaction.transactionData) {
      const txHash = await stakingApi.executeTransaction(transaction.transactionData);
      console.log('Unstaking successful!', txHash);
    }
  } catch (error) {
    console.error('Unstaking failed:', error.message);
  }
}
```

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_STAKING_API_URL=http://localhost:3004
```

### Default Values

- **Cache Duration**: 5 minutes
- **Request Timeout**: 10 seconds (Lido API), 5 seconds (alternative endpoint)
- **Chain ID**: 1 (Ethereum Mainnet)
- **Wallet Type**: smart_wallet
- **Default Gas Limit**: 21000 (0x5208)
- **Fallback Gas Price**: 20 gwei

## Best Practices

1. **Always handle errors**: Wrap API calls in try-catch blocks
2. **Use caching**: Leverage the built-in caching for better performance
3. **Validate inputs**: Check amounts before making calls
4. **Check balances**: Verify sufficient balance before unstaking
5. **Test with small amounts**: Start with small transactions for testing
6. **Monitor transaction status**: Track transaction hashes for confirmation

## Troubleshooting

### Common Issues

1. **"Account not connected"**: Ensure wallet is connected before making calls
2. **"Invalid amount"**: Verify amount is a positive number
3. **"Insufficient stETH balance"**: Check your stETH balance before unstaking
4. **"Invalid transaction data"**: Check that transaction data is properly formatted
5. **"HTTP error! status: 401"**: Token expired, will auto-refresh
6. **"Transaction failed"**: Check gas fees and network connectivity

### BigInt Issues

If you encounter issues with large numbers:

1. **Value Conversion**: The `executeTransaction` method automatically handles BigInt conversion
2. **Hex Format**: All values are properly converted to hex format
3. **Large Numbers**: Numbers exceeding JavaScript's safe integer limit are handled correctly

### Debug Mode

Enable detailed logging by checking the browser console for:
- API request/response data
- Transaction preparation steps
- BigInt conversion details
- Error details and stack traces
- Cache status information
- Authentication flow

## Dependencies

- `thirdweb/react`: For wallet connection and transaction signing
- `fetch`: For HTTP requests (built-in)
- TypeScript: For type safety

## License

This module is part of the Panorama Block DeFi platform.


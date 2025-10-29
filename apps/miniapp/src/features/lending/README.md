# Lending Service API Client

## Overview

The Lending Service API Client provides a comprehensive interface for interacting with DeFi lending protocols, specifically Benqi on Avalanche. It handles token management, position tracking, transaction preparation, and execution for lending operations.

## Features

- **Token Management**: Fetch available lending tokens with real-time APY data
- **Position Tracking**: Monitor user lending positions and health factors
- **Transaction Preparation**: Prepare supply, withdraw, borrow, and repay transactions
- **Smart Wallet Integration**: Full support for smart wallet authentication and signing
- **Caching**: Intelligent caching to prevent API overuse and improve performance
- **Error Handling**: Robust error handling with fallback mechanisms
- **Validation Fee Transparency**: Clear display of validation contract fees (10% fee, 90% net amount)

## Validation Fee System

### Overview

All lending operations go through a validation contract that charges a **10% fee**. This means:

- **Total Amount**: The amount you specify for the operation
- **Validation Fee**: 10% of the total amount is deducted as a fee
- **Net Amount**: 90% of the total amount is actually used for the lending operation

### Example

If you want to **supply 100 AVAX**:

```
Total Amount:      100 AVAX
Validation Fee:    10 AVAX (10%)
Net Amount:        90 AVAX (90%)
```

The 90 AVAX will be supplied to the lending protocol, and you'll earn APY on this amount.

### UI Display

The lending interface automatically calculates and displays:
- Total amount entered
- Validation fee (10%)
- Net amount that will be used (90%)

This information is shown in a highlighted box before executing any transaction, ensuring full transparency.

### Important Notes

- The validation fee applies to **all operations** (supply, withdraw, borrow, repay)
- The fee is deducted **before** the operation is executed
- Only the net amount (90%) participates in the lending protocol
- APY calculations are based on the net amount, not the total amount

## Architecture

### Core Components

1. **LendingApiClient**: Main service class handling all API interactions
2. **Type Definitions**: Comprehensive TypeScript interfaces for type safety
3. **Authentication**: JWT-based authentication with smart wallet signing
4. **Caching Layer**: 5-minute cache for token data to prevent rate limiting

### Data Flow

```
Frontend → LendingApiClient → Backend API → Blockchain
    ↓              ↓              ↓
Smart Wallet → JWT Auth → Benqi Protocol
```

## API Reference

### Core Methods

#### `getTokens(): Promise<LendingToken[]>`

Fetches available lending tokens with current market data.

**Returns:**
- Array of `LendingToken` objects with APY, liquidity, and collateral data

**Features:**
- 5-minute intelligent caching
- Fallback data on API failure
- Automatic retry with timeout protection

**Example:**
```typescript
const tokens = await lendingApi.getTokens();
console.log(tokens[0].supplyAPY); // 3.5
```

#### `getUserPosition(): Promise<LendingPosition | null>`

Retrieves the user's current lending position across all tokens.

**Returns:**
- `LendingPosition` object with supplied/borrowed amounts and health factor
- `null` if no position exists

**Example:**
```typescript
const position = await lendingApi.getUserPosition();
if (position) {
  console.log(`Health Factor: ${position.healthFactor}`);
}
```

### Transaction Methods

#### `prepareSupply(tokenAddress: string, amount: string): Promise<any>`

Prepares a supply transaction for depositing tokens into the lending protocol.

**Parameters:**
- `tokenAddress`: Contract address of the token to supply
- `amount`: Amount to supply (in token units)

**Returns:**
- Transaction data ready for execution

**Note:** A 10% validation fee is applied, so only 90% of the amount will be supplied to the protocol.

#### `prepareWithdraw(tokenAddress: string, amount: string): Promise<any>`

Prepares a withdrawal transaction for removing supplied tokens.

**Parameters:**
- `tokenAddress`: Contract address of the token to withdraw
- `amount`: Amount to withdraw (in token units)

**Note:** A 10% validation fee is applied, so only 90% of the amount will be withdrawn.

#### `prepareBorrow(tokenAddress: string, amount: string): Promise<any>`

Prepares a borrow transaction for taking out a loan against collateral.

**Parameters:**
- `tokenAddress`: Contract address of the token to borrow
- `amount`: Amount to borrow (in token units)

**Note:** A 10% validation fee is applied, so only 90% of the amount will be borrowed.

#### `prepareRepay(tokenAddress: string, amount: string): Promise<any>`

Prepares a repay transaction for paying back borrowed tokens.

**Parameters:**
- `tokenAddress`: Contract address of the token to repay
- `amount`: Amount to repay (in token units)

**Note:** A 10% validation fee is applied, so only 90% of the amount will be used for repayment.

### Execution Method

#### `executeTransaction(txData: any): Promise<boolean>`

Executes a prepared transaction on the blockchain using the connected wallet.

**Parameters:**
- `txData`: Transaction data from prepare methods

**Returns:**
- `true` if transaction is submitted successfully
- Throws error if transaction fails

**Features:**
- Automatic gas estimation
- MetaMask integration
- Transaction validation

### Utility Methods

#### `calculateTax(amount: string): Promise<ValidationResponse>`

Calculates tax/fees for a given amount.

#### `getSupplyQuote(tokenAddress: string, amount: string): Promise<any>`

Gets detailed quote for supply operation including fees and rates.

#### `getBorrowQuote(tokenAddress: string, amount: string): Promise<any>`

Gets detailed quote for borrow operation including fees and rates.

#### `clearLendingDataCache(): void`

Clears the token data cache (useful for testing).

#### `getCacheStatus(): { hasCache: boolean; cacheAge: number; isExpired: boolean }`

Returns current cache status for debugging.

## Type Definitions

### LendingToken

```typescript
interface LendingToken {
  symbol: string;              // Token symbol (e.g., "AVAX")
  address: string;             // Contract address
  icon?: string;               // Optional icon URL
  decimals: number;            // Token decimals
  supplyAPY: number;           // Supply interest rate (%)
  borrowAPY: number;           // Borrow interest rate (%)
  totalSupply: string;         // Total supplied amount
  totalBorrowed: string;       // Total borrowed amount
  availableLiquidity: string;  // Available liquidity
  collateralFactor: number;    // Collateral factor (0-1)
  isCollateral: boolean;       // Can be used as collateral
}
```

### LendingPosition

```typescript
interface LendingPosition {
  token: LendingToken;         // Token information
  suppliedAmount: string;      // Amount supplied by user
  borrowedAmount: string;      // Amount borrowed by user
  collateralValue: string;     // Collateral value in USD
  borrowValue: string;         // Borrow value in USD
  healthFactor: number;        // Position health factor
  liquidationThreshold: number; // Liquidation threshold
}
```

## Authentication

The client uses JWT-based authentication with smart wallet signing:

1. **Message Generation**: Creates timestamped messages for each operation
2. **Smart Wallet Signing**: Uses connected wallet to sign messages
3. **JWT Token**: Backend validates signature and returns JWT token
4. **Automatic Renewal**: Handles token refresh automatically

### Message Format

```
{Action description} {amount} of token {tokenAddress}
Timestamp: {timestamp}
```

## Error Handling

The client implements comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **API Errors**: Detailed error messages with status codes
- **Validation Errors**: Input validation with helpful messages
- **Fallback Data**: Uses cached data when API is unavailable

## Usage Examples

### Basic Setup

```typescript
import { useLendingApi } from './features/lending/api';

function LendingComponent() {
  const lendingApi = useLendingApi();
  
  // Fetch tokens
  const [tokens, setTokens] = useState([]);
  
  useEffect(() => {
    lendingApi.getTokens().then(setTokens);
  }, []);
  
  return (
    <div>
      {tokens.map(token => (
        <div key={token.address}>
          {token.symbol}: {token.supplyAPY}% APY
        </div>
      ))}
    </div>
  );
}
```

### Supply Transaction

```typescript
async function handleSupply(tokenAddress: string, amount: string) {
  try {
    // Prepare transaction
    const txData = await lendingApi.prepareSupply(tokenAddress, amount);
    
    // Execute transaction
    const success = await lendingApi.executeTransaction(txData.data.supply);
    
    if (success) {
      console.log('Supply successful!');
    }
  } catch (error) {
    console.error('Supply failed:', error.message);
  }
}
```

### Withdraw Transaction

```typescript
async function handleWithdraw(tokenAddress: string, amount: string) {
  try {
    const txData = await lendingApi.prepareWithdraw(tokenAddress, amount);
    const success = await lendingApi.executeTransaction(txData.data.withdraw);
    
    if (success) {
      console.log('Withdraw successful!');
    }
  } catch (error) {
    console.error('Withdraw failed:', error.message);
  }
}
```

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_LENDING_API_URL=http://localhost:3001
```

### Default Values

- **Cache Duration**: 5 minutes
- **Request Timeout**: 10 seconds
- **Chain ID**: 43114 (Avalanche)
- **Wallet Type**: smart_wallet

## Best Practices

1. **Always handle errors**: Wrap API calls in try-catch blocks
2. **Use caching**: Leverage the built-in caching for better performance
3. **Validate inputs**: Check amounts and addresses before making calls
4. **Monitor health factors**: Keep track of position health to avoid liquidation
5. **Test with small amounts**: Start with small transactions for testing

## Troubleshooting

### Common Issues

1. **"Account not connected"**: Ensure wallet is connected before making calls
2. **"Invalid transaction data"**: Check that transaction data is properly formatted
3. **"HTTP error! status: 400"**: Verify input parameters and authentication
4. **"Transaction failed"**: Check gas fees and network connectivity

### Debug Mode

Enable detailed logging by checking the browser console for:
- API request/response data
- Transaction preparation steps
- Error details and stack traces
- Cache status information

## Dependencies

- `thirdweb/react`: For wallet connection and transaction signing
- `fetch`: For HTTP requests (built-in)
- TypeScript: For type safety

## License

This module is part of the Panorama Block DeFi platform.

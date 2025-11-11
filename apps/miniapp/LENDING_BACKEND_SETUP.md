# Lending Backend Setup Guide

## 🚨 CORS Issue Fixed (Development)

The frontend now uses a **Next.js proxy** to avoid CORS issues during development:

### How it works:
- **Development (localhost):** API calls go to `/api/lending/*` → Next.js proxies to gateway
- **Production:** API calls go directly to `VITE_GATEWAY_BASE/lending/*`

### Configuration:
- **next.config.ts:** Added rewrite rule for `/api/lending/:path*`
- **api.ts:** Detects localhost and uses proxy automatically

---

## 📡 Required Backend Endpoints

The gateway must implement these endpoints:

### Base URL
```
https://2t43dhgf-7778.brs.devtunnels.ms/lending/
```

### Endpoints

#### 1. Get Tokens List
```http
GET /lending/dex/tokens
```

**Response:**
```json
{
  "tokens": [
    {
      "symbol": "AVAX",
      "address": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      "decimals": 18,
      "supplyAPY": 3.5,
      "borrowAPY": 5.2,
      "totalSupply": "1000000000000000000000",
      "totalBorrowed": "500000000000000000000",
      "availableLiquidity": "500000000000000000000",
      "collateralFactor": 0.8,
      "isCollateral": true
    }
  ]
}
```

#### 2. Prepare Supply Transaction
```http
POST /lending/benqi-validation/validateAndSupply
```

**Request Body:**
```json
{
  "address": "0xd6F31c5e32EE78A257A32cB6469BaB3F9fbd7561",
  "signature": "0x...",
  "message": "Validate and supply 10000000000000000 of token 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7\nTimestamp: 1762864602573",
  "timestamp": 1762864602597,
  "walletType": "smart_wallet",
  "chainId": 43114,
  "isSmartWallet": true,
  "amount": "10000000000000000",
  "qTokenAddress": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
}
```

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response:**
```json
{
  "status": 200,
  "data": {
    "supply": {
      "to": "0x...",
      "data": "0x...",
      "value": "0",
      "gas": "200000",
      "gasPrice": "25000000000"
    },
    "validation": {
      "to": "0x...",
      "data": "0x...",
      "value": "0"
    }
  }
}
```

#### 3. Prepare Withdraw Transaction
```http
POST /lending/benqi-validation/validateAndWithdraw
```
(Same structure as supply)

#### 4. Prepare Borrow Transaction
```http
POST /lending/benqi-validation/validateAndBorrow
```
(Same structure as supply)

#### 5. Prepare Repay Transaction
```http
POST /lending/benqi-validation/validateAndRepay
```
(Same structure as supply)

---

## 🔐 Authentication

The frontend sends:
- **JWT Token** in `Authorization: Bearer <token>` header
- **Wallet Address** in request body
- **Signature** (placeholder `0x000...` when using JWT)

The backend should:
1. Validate JWT token
2. Extract address from JWT
3. Verify it matches `address` in request body
4. Ignore signature if JWT is valid (signature is `0x000...`)

---

## 🛠️ CORS Configuration (Production)

For production, configure CORS on your backend:

### Express.js Example:
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://your-production-domain.com',
    'http://localhost:3000', // development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### Nginx Example:
```nginx
add_header 'Access-Control-Allow-Origin' '$http_origin' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type' always;
```

---

## 🧪 Testing

### Manual Test:
```bash
curl -X POST https://2t43dhgf-7778.brs.devtunnels.ms/lending/benqi-validation/validateAndSupply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "address": "0xd6F31c5e32EE78A257A32cB6469BaB3F9fbd7561",
    "signature": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "amount": "10000000000000000",
    "qTokenAddress": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "walletType": "smart_wallet",
    "chainId": 43114
  }'
```

---

## 📊 Current Status

✅ **Frontend:** Fully configured with proxy
✅ **Authentication:** JWT + Thirdweb working
✅ **Request Format:** Correct
❌ **Backend:** Needs implementation

**Next Step:** Implement the 5 endpoints above in your gateway.

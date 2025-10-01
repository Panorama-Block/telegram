// API configuration
export const API_CONFIG = {
  SWAP_BASE_URL: process.env.SWAP_API_BASE || 'http://localhost:3002',
  AUTH_BASE_URL: process.env.AUTH_API_BASE || 'http://localhost:3001',
} as const;

// API endpoints
export const ENDPOINTS = {
  QUOTE: '/swap/quote',
  TRANSACTION: '/swap/tx',
  AUTH_LOGIN: '/auth/login',
  AUTH_VERIFY: '/auth/verify',
} as const;

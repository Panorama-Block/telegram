export const THIRDWEB_CLIENT_ID = process.env.VITE_THIRDWEB_CLIENT_ID || process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '';

export const THIRDWEB_CONFIG = {
  clientId: THIRDWEB_CLIENT_ID,
  // Add other thirdweb configuration here if needed
} as const;

export const THIRDWEB_CLIENT_ID =
  process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
  process.env.VITE_THIRDWEB_CLIENT_ID ||
  process.env.THIRDWEB_CLIENT_ID ||
  '';

/**
 * WalletConnect v2 Project ID (Reown Cloud).
 * Required for connecting external wallets (MetaMask, Trust, Bitget, Core, etc.)
 * Create one at https://cloud.reown.com
 */
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  '';

export const THIRDWEB_CONFIG = {
  clientId: THIRDWEB_CLIENT_ID,
  walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
} as const;

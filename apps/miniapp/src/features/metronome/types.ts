/**
 * Metronome Synth — frontend types.
 *
 * Mirrors the execution-layer backend (modules/metronome) response shapes.
 * Keep aligned with `panoramablock-execution-layer/backend/src/modules/metronome/`.
 */

/* ─────────── Transaction primitives ─────────── */

export interface PreparedTransaction {
  to:          string;
  data:        string;
  value:       string;
  chainId:     number;
  description?: string;
  gasLimit?:   string;
  gasPrice?:   string;
}

/* ─────────── Markets (catalog) ─────────── */

export interface CollateralMarket {
  symbol:           string; // "msdUSDC"
  depositToken:     string; // Metronome DepositToken address
  underlying:       string; // Underlying ERC20 (e.g. native USDC)
  underlyingSymbol: string; // "USDC"
  decimals:         number; // decimals of the underlying token
}

export interface SyntheticMarket {
  symbol:    string; // "msUSD"
  debtToken: string; // Metronome DebtToken address
  synth:     string; // Synthetic ERC20 (the token the user mints)
  decimals:  number; // decimals of the synth (always 18 in current markets)
}

export interface MetronomeMarkets {
  collateral: CollateralMarket[];
  synthetic:  SyntheticMarket[];
}

/* ─────────── User position ─────────── */

export interface CollateralPosition extends CollateralMarket {
  /** Balance of the DepositToken held by the per-user Beacon proxy, in 18-dec Metronome shares. */
  shares: string;
}

export interface DebtPosition extends SyntheticMarket {
  /** Outstanding DebtToken balance held by the proxy, in synth base units. */
  debt: string;
}

export interface UserPosition {
  userAddress:  string;
  /** Deterministic Beacon-proxy address for this user. `""` if not yet predictable. */
  adapterProxy: string;
  collateral:   CollateralPosition[];
  debt:         DebtPosition[];
}

/* ─────────── Prepare-* request/response ─────────── */

/**
 * Short user-facing intent, as picked in the widget or passed via
 * `?action=` query strings. Stable across UI + entry points.
 */
export type MetronomeUiAction = 'deposit' | 'withdraw' | 'mint' | 'repay' | 'unwind';

/**
 * Backend metadata label returned by the /prepare-* endpoints. Expanded
 * vocabulary so one string identifies both the operation and its target.
 */
export type MetronomeAction =
  | 'deposit_collateral'
  | 'withdraw_collateral'
  | 'mint_synth'
  | 'repay_synth'
  | 'unwind_position';

export const UI_ACTION_TO_BACKEND: Record<MetronomeUiAction, MetronomeAction> = {
  deposit:  'deposit_collateral',
  withdraw: 'withdraw_collateral',
  mint:     'mint_synth',
  repay:    'repay_synth',
  unwind:   'unwind_position',
};

export interface MetronomePrepareMetadata {
  action:             MetronomeAction;
  depositToken?:      string;
  depositTokenSymbol?: string;
  underlyingSymbol?:  string;
  debtToken?:         string;
  debtTokenSymbol?:   string;
  synthSymbol?:       string;
  amount?:            string;
  synthAmount?:       string;
  [extra: string]:    unknown;
}

export interface TransactionBundle {
  steps:      PreparedTransaction[];
  totalSteps: number;
  summary:    string;
}

export interface PrepareResponse {
  bundle:   TransactionBundle;
  metadata: MetronomePrepareMetadata;
}

export interface PrepareDepositRequest {
  userAddress:         string;
  depositTokenAddress: string;
  amount:              string; // in underlying base units (string to preserve precision)
}

export interface PrepareWithdrawRequest {
  userAddress:         string;
  depositTokenAddress: string;
  amount:              string; // in DepositToken shares (18 decimals)
  recipient?:          string;
}

export interface PrepareMintRequest {
  userAddress:      string;
  debtTokenAddress: string;
  amount:           string; // synth base units
  recipient?:       string;
}

export interface PrepareRepayRequest {
  userAddress:      string;
  debtTokenAddress: string;
  amount:           string; // synth base units
}

export interface PrepareUnwindRequest {
  userAddress:         string;
  debtTokenAddress:    string;
  depositTokenAddress: string;
  synthAmount:         string; // must cover debt + protocol fee
  recipient?:          string;
}

/* ─────────── UI-friendly derived shapes ─────────── */

/** A single collateral row as rendered in the select view. */
export interface CollateralRowVM extends CollateralPosition {
  iconUrl: string;
}

/** A single synth-debt row as rendered in the select view. */
export interface DebtRowVM extends DebtPosition {
  iconUrl: string;
}

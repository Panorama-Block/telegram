export type LendingMode = 'supply' | 'borrow';
export type LendingFlow = 'open' | 'close';
export type StakingMode = 'stake' | 'unstake';
export type OpenWidgetTarget = 'lending' | 'staking';

export function parseLendingMode(value: unknown): LendingMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'borrow') return normalized;
  return undefined;
}

export function parseLendingFlow(value: unknown): LendingFlow | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'open' || normalized === 'close') return normalized;
  return undefined;
}

export function parseStakingMode(value: unknown): StakingMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'stake' || normalized === 'unstake') return normalized;
  return undefined;
}

export function deriveLendingModeFromAction(action: unknown): LendingMode | undefined {
  if (typeof action !== 'string') return undefined;
  const normalized = action.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'withdraw') return 'supply';
  if (normalized === 'borrow' || normalized === 'repay') return 'borrow';
  return undefined;
}

export function deriveLendingFlowFromAction(action: unknown): LendingFlow | undefined {
  if (typeof action !== 'string') return undefined;
  const normalized = action.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'borrow') return 'open';
  if (normalized === 'withdraw' || normalized === 'repay') return 'close';
  return undefined;
}

export function resolveOpenWidgetTarget(openParamRaw: string | null): OpenWidgetTarget | null {
  if (typeof openParamRaw !== 'string') return null;
  const normalized = openParamRaw.trim().toLowerCase();
  if (normalized === 'lending' || normalized === 'staking') return normalized;
  return null;
}

export function buildOpenWidgetQueryKey(target: OpenWidgetTarget, searchParams: URLSearchParams): string {
  return `${target}:${searchParams.toString()}`;
}

export function parseLendingQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const asset = searchParams.get('asset');
  const mode = parseLendingMode(searchParams.get('mode'));
  const flow = parseLendingFlow(searchParams.get('flow'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (asset) metadata.asset = asset;
  if (mode) metadata.mode = mode;
  if (flow) metadata.flow = flow;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function parseStakingQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const mode = parseStakingMode(searchParams.get('mode'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (mode) metadata.mode = mode;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

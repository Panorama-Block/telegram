type Hex = `0x${string}`;

export type ReceiptWaitOutcome = "confirmed" | "reverted" | "timeout" | "cancelled";

export type ReceiptWaitResult = {
  outcome: ReceiptWaitOutcome;
  receipt?: unknown;
  txHash?: string;
  replacementTxHash?: string;
};

type WaitForEvmReceiptParams = {
  clientId: string;
  chainId: number;
  txHash: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  shouldContinue?: () => boolean;
  tracking?: {
    fromAddress?: string;
    to?: string | null;
    data?: string | null;
  };
};

function isTxHash(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function receiptStatusToOutcome(status: unknown): "confirmed" | "reverted" {
  // Common shapes:
  // - "0x1" | "0x0"
  // - 1 | 0
  // - bigint(1) | bigint(0)
  if (typeof status === "string") return status === "0x1" ? "confirmed" : "reverted";
  if (typeof status === "number") return status === 1 ? "confirmed" : "reverted";
  if (typeof status === "bigint") return status === 1n ? "confirmed" : "reverted";
  return "confirmed";
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getWalletProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const maybeProvider = (window as any)?.ethereum;
  if (!maybeProvider || typeof maybeProvider.request !== "function") return null;
  return maybeProvider as Eip1193Provider;
}

function parseHexChainId(chainIdHex: unknown): number | null {
  if (typeof chainIdHex !== "string") return null;
  if (!/^0x[0-9a-fA-F]+$/.test(chainIdHex)) return null;
  const parsed = Number.parseInt(chainIdHex, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumberishToBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return BigInt(Math.trunc(value));
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return BigInt(trimmed);
    if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
  } catch {
    return null;
  }
  return null;
}

function normalizeAddress(address: unknown): string | null {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function normalizeTxHash(hash: unknown): Hex | null {
  if (typeof hash !== "string") return null;
  return isTxHash(hash) ? (hash as Hex) : null;
}

function normalizeHexData(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith("0x")) return null;
  if (!/^0x[0-9a-f]*$/.test(trimmed)) return null;
  return trimmed;
}

async function isWalletOnExpectedChain(provider: Eip1193Provider, expectedChainId: number): Promise<boolean> {
  try {
    const chainHex = await provider.request({ method: "eth_chainId" });
    const walletChainId = parseHexChainId(chainHex);
    if (walletChainId == null) return true;
    return walletChainId === expectedChainId;
  } catch {
    return false;
  }
}

async function getReceiptFromWallet(provider: Eip1193Provider, txHash: Hex): Promise<unknown | null> {
  try {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    return receipt ?? null;
  } catch {
    return null;
  }
}

async function getTransactionFromWallet(
  provider: Eip1193Provider,
  txHash: Hex,
): Promise<{ from: string; nonce: bigint; to: string | null; data: string | null } | null> {
  try {
    const tx = (await provider.request({
      method: "eth_getTransactionByHash",
      params: [txHash],
    })) as any;
    if (!tx || typeof tx !== "object") return null;
    const from = normalizeAddress(tx.from);
    const nonce = parseNumberishToBigInt(tx.nonce);
    if (!from || nonce == null) return null;
    return {
      from,
      nonce,
      to: normalizeAddress(tx.to),
      data: normalizeHexData(tx.input || tx.data),
    };
  } catch {
    return null;
  }
}

async function getTransactionCountFromWallet(
  provider: Eip1193Provider,
  address: string,
): Promise<bigint | null> {
  try {
    const count = await provider.request({
      method: "eth_getTransactionCount",
      params: [address, "latest"],
    });
    return parseNumberishToBigInt(count);
  } catch {
    return null;
  }
}

async function findReplacementTxHashFromWallet(
  provider: Eip1193Provider,
  params: {
    from: string;
    nonce: bigint;
    currentHash: Hex;
    maxBlocks: number;
    expectedTo?: string | null;
    expectedData?: string | null;
  },
): Promise<Hex | null> {
  const { from, nonce, currentHash, maxBlocks, expectedTo, expectedData } = params;
  const normalizedExpectedTo = normalizeAddress(expectedTo);
  const normalizedExpectedData = normalizeHexData(expectedData);

  try {
    const latestHex = await provider.request({ method: "eth_blockNumber" });
    const latest = parseNumberishToBigInt(latestHex);
    if (latest == null) return null;

    for (let offset = 0n; offset <= BigInt(maxBlocks); offset++) {
      const blockNumber = latest - offset;
      if (blockNumber < 0n) break;
      const blockHex = `0x${blockNumber.toString(16)}`;
      const block = (await provider.request({
        method: "eth_getBlockByNumber",
        params: [blockHex, true],
      })) as any;
      const transactions = Array.isArray(block?.transactions) ? block.transactions : [];
      for (const tx of transactions) {
        if (!tx || typeof tx !== "object") continue;
        const candidateHash = normalizeTxHash((tx as any).hash);
        if (!candidateHash) continue;
        if (candidateHash.toLowerCase() === currentHash.toLowerCase()) continue;
        const candidateFrom = normalizeAddress((tx as any).from);
        if (candidateFrom !== from) continue;
        const candidateNonce = parseNumberishToBigInt((tx as any).nonce);
        if (candidateNonce == null || candidateNonce !== nonce) continue;
        if (normalizedExpectedTo) {
          const candidateTo = normalizeAddress((tx as any).to);
          if (candidateTo !== normalizedExpectedTo) continue;
        }
        if (normalizedExpectedData) {
          const candidateInput = normalizeHexData((tx as any).input || (tx as any).data);
          if (candidateInput !== normalizedExpectedData) continue;
        }
        return candidateHash;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function findRecentTxHashByPayloadFromWallet(
  provider: Eip1193Provider,
  params: {
    fromAddress: string;
    currentHash: Hex;
    maxBlocks: number;
    expectedTo?: string | null;
    expectedData?: string | null;
  },
): Promise<Hex | null> {
  const { fromAddress, currentHash, maxBlocks, expectedTo, expectedData } = params;
  const normalizedFrom = normalizeAddress(fromAddress);
  if (!normalizedFrom) return null;

  const normalizedExpectedTo = normalizeAddress(expectedTo);
  const normalizedExpectedData = normalizeHexData(expectedData);

  if (!normalizedExpectedTo && !normalizedExpectedData) return null;

  try {
    const latestHex = await provider.request({ method: "eth_blockNumber" });
    const latest = parseNumberishToBigInt(latestHex);
    if (latest == null) return null;

    for (let offset = 0n; offset <= BigInt(maxBlocks); offset++) {
      const blockNumber = latest - offset;
      if (blockNumber < 0n) break;

      const blockHex = `0x${blockNumber.toString(16)}`;
      const block = (await provider.request({
        method: "eth_getBlockByNumber",
        params: [blockHex, true],
      })) as any;

      const transactions = Array.isArray(block?.transactions) ? block.transactions : [];
      for (const tx of transactions) {
        if (!tx || typeof tx !== "object") continue;

        const candidateHash = normalizeTxHash((tx as any).hash);
        if (!candidateHash) continue;
        if (candidateHash.toLowerCase() === currentHash.toLowerCase()) continue;

        const candidateFrom = normalizeAddress((tx as any).from);
        if (candidateFrom !== normalizedFrom) continue;

        if (normalizedExpectedTo) {
          const candidateTo = normalizeAddress((tx as any).to);
          if (candidateTo !== normalizedExpectedTo) continue;
        }

        if (normalizedExpectedData) {
          const candidateInput = normalizeHexData((tx as any).input || (tx as any).data);
          if (candidateInput !== normalizedExpectedData) continue;
        }

        return candidateHash;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildResult(outcome: ReceiptWaitOutcome, args: {
  trackedHash: Hex;
  originalHash: Hex;
  receipt?: unknown;
}): ReceiptWaitResult {
  const { trackedHash, originalHash, receipt } = args;
  return {
    outcome,
    receipt,
    txHash: trackedHash,
    replacementTxHash: trackedHash.toLowerCase() !== originalHash.toLowerCase() ? trackedHash : undefined,
  };
}

export async function waitForEvmReceipt(params: WaitForEvmReceiptParams): Promise<ReceiptWaitResult> {
  const {
    clientId,
    chainId,
    txHash,
    timeoutMs = 600_000,
    pollIntervalMs = 2_000,
    shouldContinue,
    tracking,
  } = params;

  if (!isTxHash(txHash)) return { outcome: "timeout", txHash };

  const normalizedChainId = Number.isFinite(Number(chainId)) ? Number(chainId) : 1;
  const walletProvider = getWalletProvider();
  const originalHash = txHash as Hex;
  let trackedHash = originalHash;
  let baseTxMeta: { from: string; nonce: bigint; to: string | null; data: string | null } | null = null;
  const trackingFromAddress = normalizeAddress(tracking?.fromAddress);
  const trackingTo = normalizeAddress(tracking?.to);
  const trackingData = normalizeHexData(tracking?.data);

  let rpc: ReturnType<(typeof import("thirdweb/rpc"))["getRpcClient"]> | null = null;
  if (clientId) {
    try {
      const { createThirdwebClient, defineChain } = await import("thirdweb");
      const { getRpcClient } = await import("thirdweb/rpc");
      const client = createThirdwebClient({ clientId });
      rpc = getRpcClient({ client, chain: defineChain(normalizedChainId) });
    } catch {
      rpc = null;
    }
  }

  if (!walletProvider && !rpc) return buildResult("timeout", { trackedHash, originalHash });

  const start = Date.now();
  const { eth_getTransactionReceipt } = await import("thirdweb/rpc");
  let nextReplacementScanAt = Date.now() + Math.max(20_000, pollIntervalMs * 8);
  let replacementScanDepth = 120;

  if (walletProvider && await isWalletOnExpectedChain(walletProvider, normalizedChainId)) {
    baseTxMeta = await getTransactionFromWallet(walletProvider, trackedHash);
  }

  while (Date.now() - start < timeoutMs) {
    if (shouldContinue && !shouldContinue()) {
      return buildResult("cancelled", { trackedHash, originalHash });
    }

    const canUseWallet =
      !!walletProvider && await isWalletOnExpectedChain(walletProvider, normalizedChainId);

    if (walletProvider && canUseWallet && !baseTxMeta) {
      const currentMeta = await getTransactionFromWallet(walletProvider, trackedHash);
      if (currentMeta) baseTxMeta = currentMeta;
    }

    if (walletProvider && canUseWallet) {
      const walletReceipt = await getReceiptFromWallet(walletProvider, trackedHash);
      if (walletReceipt) {
        const status = (walletReceipt as any)?.status;
        return buildResult(receiptStatusToOutcome(status), {
          trackedHash,
          originalHash,
          receipt: walletReceipt,
        });
      }
    }

    try {
      if (rpc) {
        const receipt = await eth_getTransactionReceipt(rpc, { hash: trackedHash });
        if (receipt) {
          const status = (receipt as any)?.status;
          return buildResult(receiptStatusToOutcome(status), {
            trackedHash,
            originalHash,
            receipt,
          });
        }
      }
    } catch {
      // ignore and keep polling
    }

    if (walletProvider && canUseWallet && Date.now() >= nextReplacementScanAt) {
      nextReplacementScanAt = Date.now() + Math.max(20_000, pollIntervalMs * 8);
      if (baseTxMeta) {
        const latestNonce = await getTransactionCountFromWallet(walletProvider, baseTxMeta.from);
        const nonceAdvanced = latestNonce != null && latestNonce > baseTxMeta.nonce;
        const shouldScan = nonceAdvanced || (Date.now() - start) > 90_000;
        if (!shouldScan) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }

        const replacementHash = await findReplacementTxHashFromWallet(walletProvider, {
          from: baseTxMeta.from,
          nonce: baseTxMeta.nonce,
          currentHash: trackedHash,
          maxBlocks: replacementScanDepth,
          expectedTo: baseTxMeta.to,
          expectedData: baseTxMeta.data,
        });
        if (replacementHash && replacementHash.toLowerCase() !== trackedHash.toLowerCase()) {
          trackedHash = replacementHash;
          const replacementMeta = await getTransactionFromWallet(walletProvider, trackedHash);
          if (replacementMeta) baseTxMeta = replacementMeta;
        } else if (nonceAdvanced && replacementScanDepth < 720) {
          replacementScanDepth = Math.min(720, replacementScanDepth * 2);
        }
      } else if (trackingFromAddress) {
        const fallbackHash = await findRecentTxHashByPayloadFromWallet(walletProvider, {
          fromAddress: trackingFromAddress,
          currentHash: trackedHash,
          maxBlocks: replacementScanDepth,
          expectedTo: trackingTo,
          expectedData: trackingData,
        });

        if (fallbackHash && fallbackHash.toLowerCase() !== trackedHash.toLowerCase()) {
          trackedHash = fallbackHash;

          const replacementReceipt = await getReceiptFromWallet(walletProvider, trackedHash);
          if (replacementReceipt) {
            const status = (replacementReceipt as any)?.status;
            return buildResult(receiptStatusToOutcome(status), {
              trackedHash,
              originalHash,
              receipt: replacementReceipt,
            });
          }

          const replacementMeta = await getTransactionFromWallet(walletProvider, trackedHash);
          if (replacementMeta) baseTxMeta = replacementMeta;
        }
      }
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return buildResult("timeout", { trackedHash, originalHash });
}

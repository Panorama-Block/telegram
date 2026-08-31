export type EvidencePolicyMode = "required" | "observe" | "disabled";

export interface ChainEvidencePolicy {
  mode: EvidencePolicyMode;
}

/**
 * Chain-level evidence policy.
 *
 * required:
 *   Transactions must have a committed evidence relationship before signing.
 *
 * observe:
 *   Evidence may be supplied, but the client does not refuse execution when
 *   evidence is absent.
 *
 * disabled:
 *   Evidence governance is explicitly disabled for the chain.
 */
const EVIDENCE_POLICY_BY_CHAIN_ID: Record<number, ChainEvidencePolicy> = {
  43114: { mode: "required" }, // Avalanche C-Chain
  8453: { mode: "observe" },   // Base
  1: { mode: "observe" },      // Ethereum
};

const DEFAULT_EVIDENCE_POLICY: ChainEvidencePolicy = {
  mode: "observe",
};

export function getChainEvidencePolicy(
  chainId: number
): ChainEvidencePolicy {
  return EVIDENCE_POLICY_BY_CHAIN_ID[chainId] ?? DEFAULT_EVIDENCE_POLICY;
}

export function chainRequiresEvidence(chainId: number): boolean {
  return getChainEvidencePolicy(chainId).mode === "required";
}

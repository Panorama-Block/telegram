import {
  sendAndConfirmTransaction,
  sendTransaction,
} from "thirdweb";

import {
  chainRequiresEvidence,
} from "./chainEvidencePolicy";

function embeddedTransactionChainId(
  transaction: any
): number | null {
  const candidate =
    transaction?.chain?.id ??
    transaction?.chainId;

  const parsed = Number(candidate);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function assertNonEvidenceTransaction(
  chainId: number,
  transaction?: any
): void {
  const embeddedChainId =
    embeddedTransactionChainId(
      transaction
    );

  if (
    embeddedChainId !== null &&
    chainRequiresEvidence(
      embeddedChainId
    )
  ) {
    throw new Error(
      `Chain ${embeddedChainId} requires evidence-bound execution before wallet submission.`
    );
  }

  if (
    embeddedChainId !== null &&
    embeddedChainId !== chainId
  ) {
    throw new Error(
      `Transaction chain ${embeddedChainId} does not match declared chain ${chainId}.`
    );
  }

  if (chainRequiresEvidence(chainId)) {
    throw new Error(
      `Chain ${chainId} requires evidence-bound execution before wallet submission.`
    );
  }
}

export async function sendThirdwebTransactionNonEvidence(
  args: {
    chainId: number;
    transaction: any;
    account: any;
  }
): Promise<any> {
  assertNonEvidenceTransaction(
    args.chainId,
    args.transaction
  );

  return sendTransaction({
    transaction: args.transaction,
    account: args.account,
  });
}

export async function sendAndConfirmThirdwebTransactionNonEvidence(
  args: {
    chainId: number;
    transaction: any;
    account: any;
  }
): Promise<any> {
  assertNonEvidenceTransaction(
    args.chainId,
    args.transaction
  );

  return sendAndConfirmTransaction({
    transaction: args.transaction,
    account: args.account,
  });
}

export async function sendAccountTransactionNonEvidence(
  args: {
    chainId: number;
    account: {
      sendTransaction?: (
        transaction: any
      ) => Promise<any>;
    };
    transaction: any;
  }
): Promise<any> {
  assertNonEvidenceTransaction(
    args.chainId,
    args.transaction
  );

  if (
    !args.account?.sendTransaction ||
    typeof args.account.sendTransaction !== "function"
  ) {
    throw new Error(
      "Wallet does not support sendTransaction."
    );
  }

  return args.account.sendTransaction(
    args.transaction
  );
}

export async function sendProviderTransactionNonEvidence(
  args: {
    chainId: number;
    provider: {
      request: (input: {
        method: string;
        params?: unknown[];
      }) => Promise<any>;
    };
    transaction: Record<string, unknown>;
  }
): Promise<any> {
  assertNonEvidenceTransaction(
    args.chainId,
    args.transaction
  );

  return args.provider.request({
    method: "eth_sendTransaction",
    params: [args.transaction],
  });
}

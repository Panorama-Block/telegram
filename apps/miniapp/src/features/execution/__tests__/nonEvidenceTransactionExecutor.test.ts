import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("thirdweb", () => ({
  sendTransaction: vi.fn(),
  sendAndConfirmTransaction: vi.fn(),
}));

import {
  sendAndConfirmTransaction,
  sendTransaction,
} from "thirdweb";

import {
  sendAccountTransactionNonEvidence,
  sendAndConfirmThirdwebTransactionNonEvidence,
  sendProviderTransactionNonEvidence,
  sendThirdwebTransactionNonEvidence,
} from "../nonEvidenceTransactionExecutor";

describe(
  "non-evidence transaction executor",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "allows Thirdweb submission on an observe chain",
      async () => {
        vi.mocked(sendTransaction)
          .mockResolvedValue({
            transactionHash: "0xabc",
          } as any);

        await sendThirdwebTransactionNonEvidence({
          chainId: 8453,
          transaction: {},
          account: {},
        });

        expect(sendTransaction)
          .toHaveBeenCalledTimes(1);
      }
    );

    it(
      "refuses Thirdweb submission on Avalanche before wallet submission",
      async () => {
        await expect(
          sendThirdwebTransactionNonEvidence({
            chainId: 43114,
            transaction: {},
            account: {},
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(sendTransaction)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses a Thirdweb transaction whose embedded Avalanche chain is disguised by an observe-chain argument",
      async () => {
        await expect(
          sendThirdwebTransactionNonEvidence({
            chainId: 8453,
            transaction: {
              chain: {
                id: 43114,
              },
            },
            account: {},
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(sendTransaction)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses an account transaction whose embedded chain does not match the declared chain",
      async () => {
        const account = {
          sendTransaction: vi.fn(),
        };

        await expect(
          sendAccountTransactionNonEvidence({
            chainId: 1,
            account,
            transaction: {
              chainId: 8453,
            },
          })
        ).rejects.toThrow(
          "Transaction chain 8453 does not match declared chain 1"
        );

        expect(account.sendTransaction)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses confirmed Thirdweb submission on Avalanche before wallet submission",
      async () => {
        await expect(
          sendAndConfirmThirdwebTransactionNonEvidence({
            chainId: 43114,
            transaction: {},
            account: {},
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(sendAndConfirmTransaction)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses account.sendTransaction on Avalanche before wallet submission",
      async () => {
        const account = {
          sendTransaction: vi.fn(),
        };

        await expect(
          sendAccountTransactionNonEvidence({
            chainId: 43114,
            account,
            transaction: {},
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(account.sendTransaction)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses eth_sendTransaction on Avalanche before provider submission",
      async () => {
        const provider = {
          request: vi.fn(),
        };

        await expect(
          sendProviderTransactionNonEvidence({
            chainId: 43114,
            provider,
            transaction: {},
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(provider.request)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "refuses a provider transaction whose embedded Avalanche chain is disguised by an observe-chain argument",
      async () => {
        const provider = {
          request: vi.fn(),
        };

        await expect(
          sendProviderTransactionNonEvidence({
            chainId: 8453,
            provider,
            transaction: {
              chainId: 43114,
            },
          })
        ).rejects.toThrow(
          "Chain 43114 requires evidence-bound execution"
        );

        expect(provider.request)
          .not.toHaveBeenCalled();
      }
    );

    it(
      "allows provider submission on Ethereum",
      async () => {
        const provider = {
          request: vi.fn()
            .mockResolvedValue("0xabc"),
        };

        await sendProviderTransactionNonEvidence({
          chainId: 1,
          provider,
          transaction: {},
        });

        expect(provider.request)
          .toHaveBeenCalledWith({
            method: "eth_sendTransaction",
            params: [{}],
          });
      }
    );
  }
);

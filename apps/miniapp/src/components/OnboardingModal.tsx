'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, ExternalLink, Wallet, Check, X } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

export function OnboardingModal() {
  const account = useActiveAccount();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const clientId = THIRDWEB_CLIENT_ID;
  const client = clientId ? createThirdwebClient({ clientId }) : null;

  // Fetch balance across main chains and show onboarding if zero
  useEffect(() => {
    if (!client || !account?.address || dismissed) {
      return;
    }

    let cancelled = false;

    const fetchBalances = async () => {
      try {
        const { eth_getBalance, getRpcClient } = await import('thirdweb/rpc');

        // Check balance on main chains (Ethereum, Base, Arbitrum)
        const chains = [1, 8453, 42161];
        let total = 0n;

        for (const chainId of chains) {
          try {
            const rpcRequest = getRpcClient({ client, chain: defineChain(chainId) });
            const balance = await eth_getBalance(rpcRequest, { address: account.address });
            total += balance;
          } catch (e) {
            // Skip chain if error
          }
        }

        if (cancelled) return;

        // Convert to ETH (18 decimals)
        const totalEth = Number(total) / 1e18;

        // Show onboarding if balance is very low
        if (totalEth < 0.0001) {
          setTimeout(() => setShowOnboarding(true), 1000);
        }
      } catch (error) {
        console.error('[Onboarding] Error fetching balances:', error);
        if (!cancelled) {
          // On error, show onboarding anyway
          setTimeout(() => setShowOnboarding(true), 1000);
        }
      }
    };

    fetchBalances();

    return () => {
      cancelled = true;
    };
  }, [client, account?.address, dismissed]);

  const handleCopyAddress = async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleDismiss = () => {
    setShowOnboarding(false);
    setDismissed(true);
    // Not persisting to storage - modal will show again on page refresh if balance is still 0
  };

  if (!account?.address) return null;

  return (
    <AnimatePresence>
      {showOnboarding && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Welcome! Fund Your Wallet</h3>
              <p className="text-sm text-zinc-400">
                Your smart wallet is ready. Deposit crypto to start using Zico.
              </p>
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-xl p-4 mx-auto w-fit">
              <QRCodeSVG
                value={account.address}
                size={160}
                level="H"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 text-center">Your wallet address</p>
              <button
                onClick={handleCopyAddress}
                className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 transition-colors"
              >
                <span className="text-xs font-mono text-zinc-300 truncate">
                  {account.address}
                </span>
                {copiedAddress ? (
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                )}
              </button>
              {copiedAddress && (
                <p className="text-xs text-green-400 text-center">Address copied!</p>
              )}
            </div>

            {/* External Links */}
            <div className="space-y-2">
              <a
                href={`https://app.uniswap.org/send?recipient=${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Send from Uniswap
              </a>
              <a
                href={`https://portfolio.metamask.io/bridge?destAddress=${account.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
              >
                <ExternalLink className="w-4 h-4" />
                Bridge from MetaMask
              </a>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="w-full text-center text-xs text-zinc-500 hover:text-white transition-colors py-2"
            >
              I'll do this later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

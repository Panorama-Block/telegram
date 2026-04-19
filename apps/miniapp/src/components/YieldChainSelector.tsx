'use client';

import { motion } from 'framer-motion';
import { X, Layers } from 'lucide-react';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { TOKEN_ICONS as AVAX_TOKEN_ICONS, JOE_ICON } from '@/features/avax-lp/config';
import { useIsMobileBreakpoint } from '@/shared/hooks/useIsMobileBreakpoint';

const AERO_ICON = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png';
const BASE_ICON = 'https://assets.coingecko.com/asset_platforms/images/131/small/base-network-logo.png';

export interface YieldChainSelectorProps {
  onSelectBase: () => void;
  onSelectAvalanche: () => void;
  onClose: () => void;
  variant?: 'modal' | 'panel';
}

export function YieldChainSelector({
  onSelectBase,
  onSelectAvalanche,
  onClose,
  variant = 'modal',
}: YieldChainSelectorProps) {
  const isMobile = useIsMobileBreakpoint();

  const header = (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onClose}
        className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <Layers className="w-5 h-5 text-white" />
        <h2 className="text-lg font-display font-bold text-white">Yield — Select Network</h2>
      </div>
    </div>
  );

  return (
    <DefiWidgetModalShell
      dataTour="widget-yield-chain-selector"
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      gradientClassName="bg-white/5"
      cardClassName="md:min-h-[300px]"
      bodyClassName="custom-scrollbar"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 sm:px-6 pb-6 space-y-3"
      >
        <p className="text-xs text-zinc-500 text-center pb-1">
          Select a network to manage liquidity positions
        </p>

        <button
          type="button"
          onClick={onSelectBase}
          className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all p-4 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              <img src={BASE_ICON} alt="Base" className="w-8 h-8 rounded-full ring-2 ring-[#0b0d0f]" />
              <img src={AERO_ICON} alt="Aerodrome" className="w-8 h-8 rounded-full ring-2 ring-[#0b0d0f]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Base — Aerodrome Finance
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">AERO rewards · Gauge-based farming</p>
            </div>
            <span className="text-xs text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-full font-medium">
              Base
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectAvalanche}
          className="w-full rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all p-4 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5">
              <img
                src={AVAX_TOKEN_ICONS.AVAX}
                alt="Avalanche"
                className="w-8 h-8 rounded-full ring-2 ring-[#0b0d0f]"
              />
              <img src={JOE_ICON} alt="TraderJoe" className="w-8 h-8 rounded-full ring-2 ring-[#0b0d0f]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">
                Avalanche — TraderJoe V1
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">JOE rewards · MasterChef farming</p>
            </div>
            <span className="text-xs text-orange-400 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 rounded-full font-medium">
              AVAX
            </span>
          </div>
        </button>
      </motion.div>
    </DefiWidgetModalShell>
  );
}

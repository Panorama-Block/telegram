'use client';

import { Droplets, X, ChevronRight } from 'lucide-react';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';

interface LiquidStakingRouterProps {
  onClose: () => void;
  onSelectLido: () => void;
  onSelectAvax: () => void;
}

const protocols = [
  {
    key: 'lido',
    name: 'Lido',
    network: 'Ethereum',
    token: 'ETH → stETH',
    description: 'Stake ETH and receive stETH. Rewards accrue automatically.',
    icon: 'https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png',
    chainColor: 'bg-blue-500/10 border-blue-500/20',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    btnColor: 'hover:bg-white/10 border-white/10',
  },
  {
    key: 'avax',
    name: 'Panorama',
    network: 'Avalanche',
    token: 'AVAX → sAVAX',
    description: 'Stake AVAX via Benqi and receive sAVAX with on-chain rewards.',
    icon: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    chainColor: 'bg-cyan-500/10 border-cyan-500/20',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    btnColor: 'hover:bg-cyan-500/10 border-white/10',
  },
];

export function LiquidStakingRouter({ onClose, onSelectLido, onSelectAvax }: LiquidStakingRouterProps) {
  const header = (
    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2">
          <Droplets className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">Liquid Staking</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Choose a protocol</p>
        </div>
      </div>
      <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <DefiWidgetModalShell onClose={onClose} header={header} showMobileHandle>
      <div className="px-5 py-4 space-y-3">
        {protocols.map((p) => (
          <button
            key={p.key}
            onClick={p.key === 'lido' ? onSelectLido : onSelectAvax}
            className={`w-full flex items-center gap-4 rounded-xl border ${p.btnColor} bg-white/[0.03] p-4 text-left transition-all hover:bg-white/5 group`}
          >
            <div className={`rounded-xl border ${p.chainColor} p-2.5 shrink-0`}>
              <img src={p.icon} alt={p.name} className="w-7 h-7 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-white text-sm">{p.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${p.badgeColor}`}>
                  {p.network}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mb-1">{p.token}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{p.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </DefiWidgetModalShell>
  );
}

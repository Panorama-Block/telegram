'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { NotificationCenter } from '@/shared/ui/NotificationCenter';
import { cn } from '@/shared/lib/utils';
import { useActiveAccount } from 'thirdweb/react';
import zicoBlue from '../../../public/icons/zico_blue.svg';

type NavItem = {
  id: string;
  label: string;
  href: string;
};

interface SeniorAppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function SeniorAppShell({ children, pageTitle = 'Panorama Block' }: SeniorAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const account = useActiveAccount();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const address = account?.address;
  const shortAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const navItems: NavItem[] = [
    { id: 'chat', label: 'Chat', href: '/chat' },
    { id: 'swap', label: 'Swap', href: '/swap' },
    { id: 'lending', label: 'Lending', href: '/lending' },
    { id: 'staking', label: 'Staking', href: '/staking' },
    { id: 'dca', label: 'DCA', href: '/dca' },
  ];

  const isActive = (href: string) => {
    if (href === '/chat') return pathname === '/chat';
    return pathname.startsWith(href);
  };

  const handleNavigate = (href: string) => {
    setIsSidebarOpen(false);
    router.push(href);
  };

  return (
    <div className="relative flex h-[100dvh] bg-[#050606] text-pano-text-primary font-sans selection:bg-pano-primary/30 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(10,196,227,0.12),transparent_50%),radial-gradient(80%_70%_at_80%_20%,rgba(11,140,194,0.08),transparent_45%)]" />

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 h-full border-r border-white/10 bg-[#0b0d0f]/95 backdrop-blur-2xl flex flex-col fixed lg:static left-0 top-0 z-50 transition-transform duration-300 shadow-[12px_0_40px_rgba(0,0,0,0.55)]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-6 flex items-center justify-between lg:justify-center border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-cyan-500/30" />
              <Image src={zicoBlue} alt="Panorama Block" width={32} height={32} className="relative drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]" />
            </div>
            <span className="font-semibold tracking-tight text-white">Panorama Block</span>
          </div>
          <button
            className="lg:hidden p-2 text-pano-text-muted hover:text-pano-text-primary rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                  active
                    ? 'text-white'
                    : 'text-pano-text-muted hover:text-white/80 hover:bg-white/5'
                )}
              >
                {active && (
                  <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl shadow-[0_0_0_1px_rgba(34,211,238,0.22)]" />
                )}
                <span className={cn('relative z-10 text-sm font-semibold tracking-wide', active && 'text-glow')}>{item.label}</span>
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full blur-[2px]" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 lg:ml-64">
        {/* Mobile Header */}
        <div className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-white/5 bg-pano-bg-secondary/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
            <span className="font-bold text-pano-text-primary">Panorama Block</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-pano-text-muted hover:text-pano-text-primary rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-20 items-center justify-between px-10 border-b border-white/5 bg-[#08090c]/90 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_18px_rgba(34,211,238,0.22)]">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen((v) => !v)}
                className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-[#0f1116]/90 border border-white/10 rounded-full hover:border-cyan-500/40 hover:shadow-[0_0_18px_rgba(34,211,238,0.28)] transition-all backdrop-blur-xl"
              >
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
                <span className="text-sm font-semibold text-white">{shortAddress || 'Wallet'}</span>
                <svg
                  className={cn('w-4 h-4 text-pano-text-muted transition-transform', isProfileOpen && 'rotate-180')}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isProfileOpen && (
                <div className="absolute top-full right-0 mt-3 w-72 bg-[#0b0d10]/95 border border-white/10 rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-2xl p-3 space-y-3">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-pano-text-muted mb-1">
                      <span>Connected</span>
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <div className="font-mono text-sm text-white">{shortAddress || '0x...'}</div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                      Wallet Dashboard
                    </button>
                    <button
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                      Settings
                    </button>
                  </div>
                  <div className="h-px bg-white/5" />
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left">
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 relative w-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

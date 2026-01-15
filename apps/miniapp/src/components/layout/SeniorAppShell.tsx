'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { NotificationCenter } from '@/shared/ui/NotificationCenter';
import { cn } from '@/shared/lib/utils';
import { useActiveAccount } from 'thirdweb/react';
import { useLogout } from '@/shared/hooks/useLogout';
import zicoBlue from '../../../public/icons/zico_blue.svg';

// Widget Modals
import { SwapWidget } from '@/components/SwapWidget';
import { Lending } from '@/components/Lending';
import { Staking } from '@/components/Staking';
import { DCA } from '@/components/DCA';

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  isModal?: boolean;
};

interface SeniorAppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function SeniorAppShell({ children, pageTitle = 'Panorama Block' }: SeniorAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const account = useActiveAccount();
  const { logout, isLoggingOut } = useLogout();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasMobileSession, setHasMobileSession] = useState(false);

  // Modal states
  const [showSwap, setShowSwap] = useState(false);
  const [showLending, setShowLending] = useState(false);
  const [showStaking, setShowStaking] = useState(false);
  const [showDCA, setShowDCA] = useState(false);

  const address = account?.address;
  const shortAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedAddress = localStorage.getItem('userAddress');
    const authToken = localStorage.getItem('authToken');
    const telegramUser = localStorage.getItem('telegram_user');
    setHasMobileSession(Boolean(address || storedAddress || authToken || telegramUser));
  }, [address]);

  const navItems: NavItem[] = [
    {
      id: 'chat',
      label: 'New Chat',
      href: '/chat',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      href: '/portfolio',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M7 11h1m4 0h5M7 15h1m4 0h5M7 19h1m4 0h5" />
          <rect x="4" y="7" width="16" height="14" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      id: 'swap',
      label: 'Swap',
      isModal: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
    },
    {
      id: 'lending',
      label: 'Lending',
      isModal: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
        </svg>
      ),
    },
    {
      id: 'staking',
      label: 'Liquid Staking',
      isModal: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
        </svg>
      ),
    },
    {
      id: 'dca',
      label: 'DCA',
      isModal: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 17.5 9.5 12l3 3 7.5-7.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 7.5H20v4.5" />
        </svg>
      ),
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.isModal) {
      if (item.id === 'swap') return showSwap;
      if (item.id === 'lending') return showLending;
      if (item.id === 'staking') return showStaking;
      if (item.id === 'dca') return showDCA;
      return false;
    }
    if (item.href === '/chat') return pathname === '/chat';
    return item.href ? pathname.startsWith(item.href) : false;
  };

  const handleNavClick = (item: NavItem) => {
    setIsSidebarOpen(false);

    if (item.isModal) {
      // Close all modals first
      setShowSwap(false);
      setShowLending(false);
      setShowStaking(false);
      setShowDCA(false);

      // Open the selected modal
      if (item.id === 'swap') setShowSwap(true);
      if (item.id === 'lending') setShowLending(true);
      if (item.id === 'staking') setShowStaking(true);
      if (item.id === 'dca') setShowDCA(true);
    } else if (item.id === 'chat') {
      // Always create new chat when clicking Chat
      if (pathname === '/chat') {
        // Already on chat page, dispatch event to create new chat
        window.dispatchEvent(new CustomEvent('panorama:newchat'));
      } else {
        // Navigate to chat with new=true to create fresh chat
        router.push('/chat?new=true');
      }
    } else if (item.href) {
      router.push(item.href);
    }
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
        <div className="p-6 flex items-center justify-center border-b border-white/5 relative">
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-cyan-500/30" />
            <Image src={zicoBlue} alt="Panorama Block" width={40} height={40} className="relative drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]" />
          </div>
          <button
            className="lg:hidden absolute right-4 p-2 text-pano-text-muted hover:text-pano-text-primary rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item, idx) => {
            const active = isActive(item);
            const needsDivider = idx > 0 && navItems[idx - 1].id === 'chat';
            return (
              <div key={item.id} className="relative flex flex-col">
                {needsDivider && <div className="my-2 h-px bg-white/10" />}
                <button
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                    active
                      ? 'text-white'
                      : 'text-pano-text-muted hover:text-white/80 hover:bg-white/5'
                  )}
                >
                  {active && (
                    <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl shadow-[0_0_0_1px_rgba(34,211,238,0.22)]" />
                  )}
                  <span className={cn('relative z-10', active && 'text-cyan-400')}>{item.icon}</span>
                  <span className={cn('relative z-10 text-sm font-semibold tracking-wide', active && 'text-glow')}>{item.label}</span>
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full blur-[2px]" />}
                </button>

                {/* New Chat button - only for Chat item */}
                {item.id === 'chat' && (
                  <button
                    onClick={() => handleNavClick(item)}
                    className="relative z-10 p-2 ml-1 text-pano-text-muted hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="New Chat"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        {hasMobileSession && (
          <div className="lg:hidden px-4 pb-5 pt-3 border-t border-white/5">
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                logout();
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
              </svg>
              {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
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
          <h1 className="text-2xl font-bold text-white tracking-tight">{pageTitle}</h1>
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
                      onClick={() => {
                        setIsProfileOpen(false);
                        router.push('/portfolio');
                      }}
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
                  <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        logout();
                      }}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
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

      {/* Widget Modals */}
      <AnimatePresence>
        {showSwap && <SwapWidget onClose={() => setShowSwap(false)} />}
        {showLending && <Lending onClose={() => setShowLending(false)} />}
        {showStaking && <Staking onClose={() => setShowStaking(false)} />}
        {showDCA && <DCA onClose={() => setShowDCA(false)} />}
      </AnimatePresence>
    </div>
  );
}

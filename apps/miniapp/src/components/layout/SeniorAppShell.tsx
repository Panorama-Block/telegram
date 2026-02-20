'use client';

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { NotificationCenter } from '@/shared/ui/NotificationCenter';
import { cn } from '@/shared/lib/utils';
import { useActiveAccount } from 'thirdweb/react';
import { useLogout } from '@/shared/hooks/useLogout';
import { useChat } from '@/shared/contexts/ChatContext';
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
  const [showChatHistory, setShowChatHistory] = useState(true);

  // Chat context for conversation history
  const { 
    conversations, 
    activeConversationId, 
    isLoading: isLoadingConversations,
    createConversation,
    setActiveConversationId,
    isCreatingConversation 
  } = useChat();

  // Modal states
  const [showSwap, setShowSwap] = useState(false);
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
      href: '/chat?open=lending',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
        </svg>
      ),
    },
    {
      id: 'staking',
      label: 'Liquid Staking',
      href: '/chat?open=staking',
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
      if (item.id === 'dca') return showDCA;
      return false;
    }
    if (item.href === '/chat') return pathname === '/chat';
    return item.href ? pathname.startsWith(item.href) : false;
  };

  const handleNewChat = useCallback(() => {
    setIsSidebarOpen(false);
    
    if (pathname === '/chat') {
      // Already on chat page, signal to show new chat welcome screen
      // Don't create conversation in backend - will be created on first message
      window.dispatchEvent(new CustomEvent('panorama:newchat', { detail: { pending: true } }));
    } else {
      // Navigate to chat with new=true to show welcome screen
      router.push('/chat?new=true');
    }
  }, [pathname, router]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setIsSidebarOpen(false);
    setActiveConversationId(conversationId);
    
    if (pathname !== '/chat') {
      router.push(`/chat?id=${conversationId}`);
    } else {
      // Dispatch event for chat page to switch conversation
      window.dispatchEvent(new CustomEvent('panorama:selectchat', { detail: { conversationId } }));
    }
  }, [pathname, router, setActiveConversationId]);

  const handleNavClick = (item: NavItem) => {
    setIsSidebarOpen(false);

    if (item.isModal) {
      // Close all modals first
      setShowSwap(false);
      setShowDCA(false);

      // Open the selected modal
      if (item.id === 'swap') setShowSwap(true);
      if (item.id === 'dca') setShowDCA(true);
    } else if (item.id === 'chat') {
      handleNewChat();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <div className="relative flex h-[100dvh] bg-[#050606] text-pano-text-primary font-sans selection:bg-pano-primary/30 overflow-hidden safe-area-pb">
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
            className="lg:hidden absolute right-4 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-pano-text-muted hover:text-pano-text-primary active:text-pano-text-primary rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item, idx) => {
            const active = isActive(item);
            const isNewChatItem = item.id === 'chat';
            const needsDivider = idx > 0 && navItems[idx - 1].id === 'chat';
            
            return (
              <div key={item.id} className="relative flex flex-col">
                {needsDivider && <div className="my-2 h-px bg-white/10" />}
                
                {/* New Chat button with special styling */}
                {isNewChatItem ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleNavClick(item)}
                      disabled={isCreatingConversation}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                        active
                          ? 'text-white'
                          : 'text-pano-text-muted hover:text-white/80 hover:bg-white/5',
                        isCreatingConversation && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {active && (
                          <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl shadow-[0_0_0_1px_rgba(34,211,238,0.22)]" />
                        )}
                        <span className={cn('relative z-10', active && 'text-cyan-400')}>
                          {isCreatingConversation ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : item.icon}
                        </span>
                        <span className={cn('relative z-10 text-sm font-semibold tracking-wide', active && 'text-glow')}>
                          {item.label}
                        </span>
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full blur-[2px]" />}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                      </svg>
                    </button>
                    
                    {/* Chat History Section */}
                    <div className="mt-2">
                      <button
                        onClick={() => setShowChatHistory(!showChatHistory)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                      >
                        <span className="font-medium uppercase tracking-wider">Recent Chats</span>
                        <svg 
                          className={cn('w-4 h-4 transition-transform', showChatHistory && 'rotate-180')} 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      <AnimatePresence>
                        {showChatHistory && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                              {isLoadingConversations ? (
                                <div className="px-4 py-3 text-xs text-zinc-500 flex items-center gap-2">
                                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Loading...
                                </div>
                              ) : conversations.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-zinc-500">
                                  No conversations yet
                                </div>
                              ) : (
                                conversations.slice(0, 8).map((conversation) => {
                                  const isActiveConv = activeConversationId === conversation.id;
                                  return (
                                    <button
                                      key={conversation.id}
                                      onClick={() => handleSelectConversation(conversation.id)}
                                      className={cn(
                                        'w-full text-left px-4 py-2 rounded-lg text-xs transition-all truncate',
                                        isActiveConv
                                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <span className="truncate">{conversation.title}</span>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      'flex-1 flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-xl transition-all duration-300 group relative overflow-hidden touch-action-manipulation',
                      active
                        ? 'text-white'
                        : 'text-pano-text-muted hover:text-white/80 hover:bg-white/5 active:bg-white/10 active:text-white'
                    )}
                  >
                    {active && (
                      <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl shadow-[0_0_0_1px_rgba(34,211,238,0.22)]" />
                    )}
                    <span className={cn('relative z-10', active && 'text-cyan-400')}>{item.icon}</span>
                    <span className={cn('relative z-10 text-sm font-semibold tracking-wide', active && 'text-glow')}>{item.label}</span>
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full blur-[2px]" />}
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
        <div className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-white/5 bg-pano-bg-secondary/90 backdrop-blur-md sticky top-0 z-30 safe-area-pt">
          <div className="flex items-center gap-3">
            <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
            <span className="font-bold text-pano-text-primary">Panorama Block</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-pano-text-muted hover:text-pano-text-primary active:text-pano-text-primary rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-sm text-white/80 hover:text-white hover:bg-white/5 active:bg-white/10 rounded-lg transition-colors text-left"
                    >
                      Portfolio
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
        {showDCA && <DCA onClose={() => setShowDCA(false)} />}
      </AnimatePresence>
    </div>
  );
}

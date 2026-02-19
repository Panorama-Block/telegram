'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useWalletIdentity } from '@/shared/contexts/WalletIdentityContext';
import { resolveChatIdentity } from '@/shared/lib/chatIdentity';
import { useNotifications } from '@/features/gateway/hooks';
import type { Notification, NotificationType, NotificationPriority } from '@/features/gateway/types';
import { Bell, Check, Skull, AlertTriangle, Info, Trash2, CheckCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface TypeStyle {
  icon: React.ElementType;
  color: string;
  bg: string;
}

const TYPE_STYLES: Record<NotificationType, TypeStyle> = {
  tx_confirmed: { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10' },
  tx_failed: { icon: Skull, color: 'text-red-400', bg: 'bg-red-400/10' },
  health_warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  price_alert: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  dca_executed: { icon: Check, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  stake_matured: { icon: Check, color: 'text-green-400', bg: 'bg-green-400/10' },
  welcome: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

function priorityClass(priority: NotificationPriority): string {
  switch (priority) {
    case 'urgent':
      return 'border-l-2 border-red-500 animate-pulse';
    case 'high':
      return 'border-l-2 border-red-500';
    case 'low':
      return 'opacity-70';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve userId using the same pattern as ChatContext
  const account = useActiveAccount();
  const { user: telegramUser } = useAuth();
  const { address: identityAddress, tonAddress, tonAddressRaw } = useWalletIdentity();

  const userId = useMemo(() => {
    const identity = resolveChatIdentity({
      accountAddress: account?.address,
      identityAddress,
      tonAddress,
      tonAddressRaw,
      telegramUserId: telegramUser?.id,
    });
    return identity.userId ?? '';
  }, [account?.address, identityAddress, tonAddress, tonAddressRaw, telegramUser?.id]);

  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications({ userId, autoRefresh: true, refreshInterval: 30000 });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) {
      markRead(n.id);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-pano-text-muted hover:text-pano-text transition-colors rounded-full"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-pano-bg-card border border-pano-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pano-border">
              <h3 className="text-sm font-semibold text-pano-text">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-pano-text-muted hover:text-pano-text transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-pano-text-muted animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="w-8 h-8 text-pano-text-muted/40 mb-2" />
                  <p className="text-sm text-pano-text-muted">No notifications yet</p>
                  <p className="text-xs text-pano-text-muted/60 mt-1">
                    Swap confirmations and alerts will appear here
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-pano-border">
                  {notifications.map((n) => {
                    const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.welcome;
                    const Icon = style.icon;

                    return (
                      <li
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-pano-bg-hover transition-colors',
                          !n.isRead && 'bg-pano-bg-hover/50',
                          priorityClass(n.priority),
                        )}
                      >
                        {/* Icon */}
                        <div className={cn('mt-0.5 flex-shrink-0 rounded-full p-1.5', style.bg)}>
                          <Icon className={cn('w-4 h-4', style.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm leading-snug', n.isRead ? 'text-pano-text-muted' : 'text-pano-text font-medium')}>
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="text-xs text-pano-text-muted mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-pano-text-muted/60 mt-1 block">
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          className="mt-0.5 flex-shrink-0 p-1 rounded hover:bg-pano-bg-hover text-pano-text-muted/40 hover:text-red-400 transition-colors"
                          aria-label="Dismiss notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

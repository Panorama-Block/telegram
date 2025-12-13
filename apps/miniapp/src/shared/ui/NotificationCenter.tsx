'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

type NotificationType = 'success' | 'critical' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const typeStyles: Record<NotificationType, { badge: string; dot: string }> = {
  success: { badge: 'bg-green-500/10 border-green-500/20 text-green-400', dot: 'bg-green-400' },
  critical: { badge: 'bg-red-500/10 border-red-500/20 text-red-400', dot: 'bg-red-400' },
  info: { badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400', dot: 'bg-blue-400' },
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'critical', title: 'Health Factor Danger', message: 'Your position is at 1.05', time: '2m', read: false },
    { id: '2', type: 'success', title: 'DCA Executed', message: 'Buy 0.1 ETH @ $1820', time: '1h', read: false },
    { id: '3', type: 'info', title: 'New Feature', message: 'Dark Mode is active', time: '5h', read: true },
  ]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const clearAll = () => setNotifications([]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 text-pano-text-muted hover:text-pano-text-primary hover:bg-white/5 rounded-full transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 10a2 2 0 10-4 0v1.586a1 1 0 01-.293.707L8 14h8l-1.707-1.707A1 1 0 0114 11.586V10z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 14h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 18h4" />
        </svg>
        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-pano-bg-primary" />}
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-pano-bg-secondary/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h3 className="font-bold text-pano-text-primary text-sm">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] flex items-center gap-1 text-pano-text-muted hover:text-pano-text-primary transition-colors uppercase tracking-wider"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-pano-text-muted text-sm">No notifications yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => {
                  const styles = typeStyles[notification.type];
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 hover:bg-white/5 transition-colors cursor-pointer relative group',
                        !notification.read && 'bg-white/[0.02]'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 border', styles.badge)}>
                          <span className="text-[10px] font-bold uppercase">{notification.type[0]}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-pano-text-primary">{notification.title}</span>
                            <span className="text-[10px] text-pano-text-muted">{notification.time}</span>
                          </div>
                          <p className="text-xs text-pano-text-muted leading-relaxed">{notification.message}</p>
                        </div>
                      </div>
                      {!notification.read && <div className={cn('absolute top-4 right-2 w-1.5 h-1.5 rounded-full', styles.dot)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

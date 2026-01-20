'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Info, Skull, Trash2, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/shared/hooks/useNotifications";
import { formatNotificationTime } from "@/shared/services/notifications";
import type { NotificationData, NotificationType } from "@/shared/services/notifications/types";

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotifications();

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-green-400" />;
      case 'error': return <Skull className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'info':
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getBgColor = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'error': return 'bg-red-500/10 border-red-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'pending': return 'bg-blue-500/10 border-blue-500/20';
      case 'info':
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Open explorer if available
    if (notification.metadata?.explorerUrl) {
      window.open(notification.metadata.explorerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full ring-2 ring-[#050505] flex items-center justify-center text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-12 right-0 w-80 sm:w-96 bg-[#0A0A0A]/90 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-white text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-cyan-400 transition-colors uppercase tracking-wider"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearAll()}
                      className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wider"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    <Clock className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "p-4 hover:bg-white/5 transition-colors cursor-pointer relative group",
                          !notification.read && "bg-white/[0.02]"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                            getBgColor(notification.type)
                          )}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-white truncate">
                                {notification.title}
                              </span>
                              <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                {formatNotificationTime(notification.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>

                            {/* Transaction metadata */}
                            {notification.metadata?.hash && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                                  {notification.metadata.hash.slice(0, 10)}...
                                </span>
                                {notification.metadata.explorerUrl && (
                                  <ExternalLink className="w-3 h-3 text-cyan-400" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                          >
                            <Trash2 className="w-3 h-3 text-zinc-500 hover:text-red-400" />
                          </button>
                        </div>

                        {/* Unread indicator */}
                        {!notification.read && (
                          <div className="absolute top-4 right-2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-2 border-t border-white/5 bg-white/[0.02]">
                  <div className="text-[10px] text-center text-zinc-600">
                    Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Info, Skull, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'critical',
      title: 'Health Factor Danger',
      message: 'Your Benqi position is at 1.05',
      time: '2 min ago',
      read: false
    },
    {
      id: '2',
      type: 'success',
      title: 'DCA Executed',
      message: 'Buy 0.1 ETH @ $1820',
      time: '1 hour ago',
      read: false
    },
    {
      id: '3',
      type: 'info',
      title: 'New Feature',
      message: 'Dark Mode is active',
      time: '5 hours ago',
      read: true
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-green-400" />;
      case 'critical': return <Skull className="w-4 h-4 text-red-400" />;
      case 'info': return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getBgColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'critical': return 'bg-red-500/10 border-red-500/20';
      case 'info': return 'bg-blue-500/10 border-blue-500/20';
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
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#050505]" />
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
              className="absolute top-12 right-0 w-80 bg-[#0A0A0A]/90 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="font-display font-bold text-white text-sm">Notifications</h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={clearAll}
                    className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
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
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-white">{notification.title}</span>
                              <span className="text-[10px] text-zinc-500">{notification.time}</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="absolute top-4 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

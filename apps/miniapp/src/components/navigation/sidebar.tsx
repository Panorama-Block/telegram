'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/shared/contexts/AuthContext';

interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  isActive?: boolean;
}

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    href: '/chat',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    badge: 'AI',
  },
  {
    id: 'swap',
    label: 'Swap',
    href: '/swap',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const quickActions = [
  {
    id: 'quick-swap',
    label: 'Quick Swap',
    action: () => console.log('Quick swap'),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'new-chat',
    label: 'New Chat',
    action: () => console.log('New chat'),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
];

export function Sidebar({ className, collapsed = false, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavigation = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const handleQuickAction = useCallback((action: () => void) => {
    action();
  }, []);

  const getActiveState = useCallback((href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  }, [pathname]);

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-full bg-pano-bg-primary border-r border-pano-border transition-all duration-300 ease-out z-40',
        collapsed ? 'w-16' : 'w-64',
        'hidden lg:flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-pano-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pano-primary to-pano-secondary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-pano-text-primary">PanoramaBlock</h1>
              <p className="text-xs text-pano-text-muted">Web3 Trading</p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 p-0 hover:bg-pano-surface-elevated"
        >
          <svg
            className={cn("w-4 h-4 transition-transform duration-200", collapsed && "rotate-180")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const isActive = getActiveState(item.href);

            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => handleNavigation(item.href)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  'w-full justify-start gap-3 h-10 px-3',
                  collapsed && 'px-2 justify-center',
                  isActive && 'bg-pano-primary text-pano-text-on-primary shadow-lg',
                  !isActive && 'hover:bg-pano-surface-elevated'
                )}
              >
                <div className="flex-shrink-0">
                  {item.icon}
                </div>

                {!collapsed && (
                  <>
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-pano-primary/10 text-pano-primary'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && hoveredItem === item.id && (
                  <div className="absolute left-16 bg-pano-surface-elevated border border-pano-border rounded-lg px-3 py-2 text-sm font-medium text-pano-text-primary shadow-lg z-50 whitespace-nowrap">
                    {item.label}
                    {item.badge && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-pano-primary/10 text-pano-primary rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Quick Actions */}
        {!collapsed && (
          <div className="px-3 mt-6">
            <div className="text-xs font-medium text-pano-text-secondary uppercase tracking-wide mb-3 px-3">
              Quick Actions
            </div>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuickAction(action.action)}
                  className="w-full justify-start gap-3 h-9 px-3 hover:bg-pano-surface-elevated"
                >
                  <div className="flex-shrink-0">
                    {action.icon}
                  </div>
                  <span className="flex-1 text-left text-sm">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="border-t border-pano-border p-3">
        {user ? (
          <Card variant="ghost" className="border-pano-accent/20">
            <CardContent className={cn("p-3", collapsed && "p-2")}>
              {collapsed ? (
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full bg-pano-primary flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.first_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pano-primary flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.first_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pano-text-primary truncate">
                      {user.first_name || user.username || 'User'}
                    </p>
                    <p className="text-xs text-pano-text-muted truncate">
                      {user.username ? `@${user.username}` : 'Connected'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full", collapsed && "px-2")}
            onClick={() => router.push('/auth')}
          >
            {collapsed ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Connect
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Mobile sidebar overlay
export function MobileSidebar({
  isOpen,
  onClose,
  className
}: {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-64 bg-pano-bg-primary border-r border-pano-border z-50 lg:hidden",
        "transform transition-transform duration-300 ease-out",
        className
      )}>
        <Sidebar />

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 p-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </>
  );
}

// Hook for sidebar state management
export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return {
    collapsed,
    mobileOpen,
    toggleCollapse,
    toggleMobile,
    closeMobile,
  };
}
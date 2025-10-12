'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/shared/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

const publicRoutes = ['/', '/auth'];

function normalizePathname(pathname: string) {
  if (!pathname) return pathname;

  if (pathname === '/') {
    return pathname;
  }

  const basePath =
    typeof window !== 'undefined'
      ? (window as any)?.__NEXT_DATA__?.runtimeConfig?.basePath ?? ''
      : '';

  if (basePath && pathname.startsWith(basePath)) {
    const stripped = pathname.slice(basePath.length);
    return stripped || '/';
  }

  return pathname;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const hasWalletAuth = !!authToken;
    const normalizedPath = normalizePathname(pathname);
    const isPublicRoute = publicRoutes.includes(normalizedPath);
    
    // Check if we have Telegram user ID in URL params (from Telegram miniapp)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const telegramUserId = urlParams?.get('telegram_user_id');
    const hasTelegramUser = !!telegramUserId;
    
    const canAccessProtectedRoute = isAuthenticated || hasWalletAuth || hasTelegramUser;

    console.log('🛡️ [AUTHGUARD DEBUG]', {
      pathname: normalizedPath,
      isAuthenticated,
      isLoading,
      hasWalletAuth,
      hasTelegramUser,
      telegramUserId,
      telegram_user: typeof window !== 'undefined' ? localStorage.getItem('telegram_user') : null,
      authToken: authToken ? `${authToken.slice(0, 20)}...` : null
    });

    if (!isLoading) {
      // For protected routes, ensure wallet, Telegram authentication, or Telegram user ID is present
      if (!canAccessProtectedRoute && !isPublicRoute) {
        console.log('🔒 [AUTHGUARD] Redirecting to /auth - missing authentication credentials');
        router.push('/auth');
      }
      // Don't redirect from /auth - let user connect wallet first
      // else if (isAuthenticated && pathname === '/auth') {
      //   router.push('/dashboard');
      // }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #e0e0e0',
          borderTop: '3px solid #007aff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
      </div>
    );
  }

  // Show nothing while redirecting
  const normalizedPath = normalizePathname(pathname);
  const isPublicRoute = publicRoutes.includes(normalizedPath);
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const hasWalletAuth = !!authToken;
  
  // Check if we have Telegram user ID in URL params (from Telegram miniapp)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const telegramUserId = urlParams?.get('telegram_user_id');
  const hasTelegramUser = !!telegramUserId;
  
  const canAccessProtectedRoute = isAuthenticated || hasWalletAuth || hasTelegramUser;

  if (!canAccessProtectedRoute && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}

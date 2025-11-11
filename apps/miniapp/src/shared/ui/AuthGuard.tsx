'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/shared/contexts/AuthContext';
import './loader.css';

interface AuthGuardProps {
  children: React.ReactNode;
}

const publicRoutes = [
  '/',
  '/auth',
  '/auth/callback',
  '/auth/external',
  '/auth/wallet-external',
  '/swap/external',
  '/newchat',
];

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
    const canAccessProtectedRoute = isAuthenticated || hasWalletAuth;

    console.log('🛡️ [AUTHGUARD DEBUG]', {
      pathname: normalizedPath,
      isAuthenticated,
      isLoading,
      hasWalletAuth,
      telegram_user: typeof window !== 'undefined' ? localStorage.getItem('telegram_user') : null,
      authToken: authToken ? `${authToken.slice(0, 20)}...` : null
    });

    if (!isLoading) {
      // For protected routes, ensure wallet or Telegram authentication is present
      if (!canAccessProtectedRoute && !isPublicRoute) {
        console.log('🔒 [AUTHGUARD] Redirecting to /newchat - missing authentication credentials');
        router.push('/newchat');
      }
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-pano-bg-primary flex items-center justify-center">
        <div className="loader-custom"></div>
      </div>
    );
  }

  // Show nothing while redirecting
  const normalizedPath = normalizePathname(pathname);
  const isPublicRoute = publicRoutes.includes(normalizedPath);
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const hasWalletAuth = !!authToken;
  const canAccessProtectedRoute = isAuthenticated || hasWalletAuth;

  if (!canAccessProtectedRoute && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}

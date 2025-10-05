'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/shared/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

const publicRoutes = ['/', '/auth'];

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const hasWalletAuth = !!authToken;

    console.log('🛡️ [AUTHGUARD DEBUG]', {
      pathname,
      isAuthenticated,
      isLoading,
      hasWalletAuth,
      telegram_user: typeof window !== 'undefined' ? localStorage.getItem('telegram_user') : null,
      authToken: authToken ? `${authToken.slice(0, 20)}...` : null
    });

    if (!isLoading) {
      const isPublicRoute = publicRoutes.includes(pathname);

      // For protected routes, check wallet authentication (authToken)
      if (!hasWalletAuth && !isPublicRoute) {
        console.log('🔒 [AUTHGUARD] Redirecting to /auth - no wallet auth');
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
  const isPublicRoute = publicRoutes.includes(pathname);
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}

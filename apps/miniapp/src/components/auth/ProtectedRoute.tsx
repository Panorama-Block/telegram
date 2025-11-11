'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import '@/shared/ui/loader.css';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');

      if (!authToken) {
        // Not authenticated, redirect to login/newchat
        router.replace('/newchat');
        return;
      }

      // Authenticated
      setIsAuthenticated(true);
      setIsChecking(false);
    };

    checkAuth();
  }, [router]);

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-pano-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-6">
          {/* Logo with glow effects */}
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-400/30 blur-3xl rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" style={{ animationDelay: '0.5s' }} />
            <div className="absolute -inset-4 bg-cyan-500/15 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            <Image
              src={zicoBlue}
              alt="Zico Blue"
              width={120}
              height={120}
              className="relative h-24 w-24 lg:h-30 lg:w-30"
            />
          </div>

          {/* Loading text */}
          <div className="text-center">
            <p className="text-white text-base font-medium">
              Verifying authentication...
            </p>
          </div>

          {/* Loading indicator */}
          <div className="flex items-center gap-2">
            <div className="loader-inline-sm" />
          </div>
        </div>
      </div>
    );
  }

  // Only render children if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

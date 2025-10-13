'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { WalletConnectPanel } from '../../features/wallets/evm/WalletConnectPanel';
import { MobileLayout } from '../../components/layout/MobileLayout';
import { Container } from '../../components/layout/Container';
import { Stack } from '../../components/layout/Stack';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import pblokNav from '../../../public/logos/pblok_nav.svg';
import zicoBlue from '../../../public/icons/zico_blue.svg';

export default function AuthPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check wallet authentication (not Telegram auth)
  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const wasAuthenticated = isAuthenticated;
      const isNowAuthenticated = !!authToken;

      setIsAuthenticated(isNowAuthenticated);

      // Auto-redirect to chat when authentication happens
      if (!wasAuthenticated && isNowAuthenticated) {
        router.push('/chat');
      }
    };

    checkAuth();

    // Listen for storage changes (when wallet authenticates)
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, router]);

  const handleContinue = () => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  };

  const AuthHeader = () => (
    <div className="sticky top-0 z-50 bg-pano-surface/95 backdrop-blur-md border-b border-pano-border/20">
      <Container padding={true}>
        <div className="flex items-center justify-between h-16">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="p-0 h-auto"
          >
            <Image
              src={pblokNav}
              alt="Panorama Block"
              width={140}
              height={32}
              className="h-6 sm:h-8 w-auto"
              priority
            />
          </Button>
        </div>
      </Container>
    </div>
  );

  return (
    <MobileLayout
      header={<AuthHeader />}
      padding={false}
      className="bg-pano-bg-primary"
    >
      <Container size="md" className="py-8 sm:py-12">
        <Stack direction="vertical" gap="xl" className="max-w-lg mx-auto">
          {/* Hero Section */}
          <Stack direction="vertical" gap="lg" align="center" className="text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-pano-primary/20 rounded-full blur-xl animate-pulse"></div>
              <Image
                src={zicoBlue}
                alt="Zico AI Assistant"
                width={96}
                height={96}
                className="w-20 h-20 sm:w-24 sm:h-24 relative z-10"
                priority
              />
            </div>

            <Stack direction="vertical" gap="sm" align="center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-pano-text-primary">
                Connect Your Wallet
              </h1>
              <p className="text-pano-text-secondary text-sm sm:text-base max-w-md">
                Connect your wallet to access AI-powered DeFi tools and start trading with intelligent insights
              </p>
            </Stack>
          </Stack>

          {/* Wallet Connection Card */}
          <Card
            variant="glass"
            size="lg"
            className="border-pano-border/30 glow-primary"
          >
            <WalletConnectPanel />
          </Card>

          {/* Continue Button (shown when authenticated) */}
          {isAuthenticated && (
            <Stack direction="vertical" gap="md" align="center">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleContinue}
                className="animate-fadeIn"
              >
                Continue to Chat
              </Button>
              <p className="text-xs text-pano-text-muted text-center">
                You&apos;ll be redirected automatically in a moment
              </p>
            </Stack>
          )}

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <Card variant="ghost" size="sm" className="text-center">
              <Stack direction="vertical" gap="sm" align="center">
                <div className="w-8 h-8 bg-pano-primary/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-pano-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-pano-text-primary">Secure</h3>
                  <p className="text-xs text-pano-text-secondary">Non-custodial wallet connection</p>
                </div>
              </Stack>
            </Card>

            <Card variant="ghost" size="sm" className="text-center">
              <Stack direction="vertical" gap="sm" align="center">
                <div className="w-8 h-8 bg-pano-primary/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-pano-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-pano-text-primary">AI-Powered</h3>
                  <p className="text-xs text-pano-text-secondary">Smart trading insights</p>
                </div>
              </Stack>
            </Card>
          </div>
        </Stack>
      </Container>
    </MobileLayout>
  );
}

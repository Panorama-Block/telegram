'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { WalletConnectPanel } from '../../features/wallets/evm/WalletConnectPanel';
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

  return (
    <div className="min-h-screen bg-[#0d1117] text-white relative overflow-hidden">

      {/* Navbar */}
      <nav className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
            <Image
              src={pblokNav}
              alt="Panorama Block"
              width={140}
              height={40}
              className="h-8 sm:h-10 w-auto"
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Image
                src={zicoBlue}
                alt="Zico"
                width={120}
                height={120}
                className="w-24 h-24 sm:w-32 sm:h-32"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Connect Your Wallet</h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Get started by connecting your wallet to access AI-powered DeFi tools
            </p>
          </div>

          {/* Wallet Connect Panel */}
          <div className="bg-[#1a1a1a]/80 backdrop-blur-lg border border-cyan-500/30 rounded-2xl p-6 sm:p-8 shadow-xl shadow-cyan-500/10">
            <WalletConnectPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

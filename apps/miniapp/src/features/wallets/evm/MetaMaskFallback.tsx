'use client';

import React, { useState, useEffect } from 'react';
import { inAppWallet } from 'thirdweb/wallets';

interface MetaMaskFallbackProps {
  onConnect: (wallet: any) => void;
  onError: (error: string) => void;
}

export function MetaMaskFallback({ onConnect, onError }: MetaMaskFallbackProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Detectar se estamos em um miniapp do Telegram
    const isTelegramMiniApp = typeof window !== 'undefined' && 
      (window as any).Telegram?.WebApp || 
      navigator.userAgent.includes('TelegramBot');

    if (isTelegramMiniApp) {
      // Verificar se MetaMask está disponível
      const checkMetaMask = () => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          return true;
        }
        return false;
      };

      // Se não há MetaMask, mostrar fallback após 5 segundos
      if (!checkMetaMask()) {
        const timer = setTimeout(() => {
          setShowFallback(true);
        }, 5000);

        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleInAppWalletConnect = async () => {
    setIsLoading(true);
    try {
      // Usar In-App Wallet como fallback
      const wallet = inAppWallet({ 
        auth: { 
          options: ['google', 'telegram'],
          redirectUrl: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : undefined
        } 
      });
      
      onConnect(wallet);
    } catch (error) {
      console.error('❌ [FALLBACK] Erro ao conectar In-App Wallet:', error);
      onError('Erro ao conectar wallet alternativa');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showFallback) {
    return null;
  }

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      background: '#1a1a1a',
      borderRadius: 12,
      border: '1px solid #374151',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>
        ⚠️ MetaMask não está disponível neste ambiente
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
        Use a In-App Wallet como alternativa:
      </div>
      <button
        onClick={handleInAppWalletConnect}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '12px 20px',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          background: '#10b981',
          color: '#fff',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Conectando...' : 'Conectar com In-App Wallet'}
      </button>
    </div>
  );
}

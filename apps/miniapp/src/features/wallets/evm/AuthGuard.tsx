'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../../../shared/ui';

interface AuthGuardProps {
  children?: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    // Verificar se há JWT no localStorage
    const authToken = localStorage.getItem('authToken');
    const authPayload = localStorage.getItem('authPayload');
    const authSignature = localStorage.getItem('authSignature');

    if (authToken && authPayload && authSignature) {
      try {
        const payload = JSON.parse(authPayload);
        const address = payload.address;
        
        if (address) {
          setIsAuthenticated(true);
          setAuthMessage(`✅ Autenticado: ${address.slice(0, 6)}...${address.slice(-4)}`);
          
          localStorage.setItem('userAddress', address);
        } else {
          setAuthMessage('❌ Token inválido');
        }
      } catch (error) {
        setAuthMessage('❌ Erro ao verificar autenticação');
        console.error('❌ [AUTH GUARD] Erro ao parsear payload:', error);
      }
    } else {
      setAuthMessage('❌ Não autenticado - redirecionando para dashboard');
      
      // Redirecionar para dashboard após um pequeno delay
      setTimeout(() => {
        window.location.href = '/miniapp/dashboard';
      }, 2000);
    }
    
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <Card style={{ marginBottom: 16, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #687280)' }}>
          🔄 Verificando autenticação...
        </div>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card style={{ marginBottom: 16, padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>
          {authMessage}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)' }}>
          Redirecionando para dashboard...
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 14, color: '#10b981', marginBottom: 4 }}>
        {authMessage}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)' }}>
        Pronto para executar transações
      </div>
      {children}
    </Card>
  );
}

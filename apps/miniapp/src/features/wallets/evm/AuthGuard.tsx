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
    // Check if there is a JWT persisted locally
    const authToken = localStorage.getItem('authToken');
    const authPayload = localStorage.getItem('authPayload');
    const authSignature = localStorage.getItem('authSignature');

    if (authToken && authPayload && authSignature) {
      try {
        const payload = JSON.parse(authPayload);
        const address = payload.address;
        
        if (address) {
          setIsAuthenticated(true);
          setAuthMessage(`✅ Authenticated: ${address.slice(0, 6)}...${address.slice(-4)}`);
          
          localStorage.setItem('userAddress', address);
        } else {
          setAuthMessage('❌ Invalid token');
        }
      } catch (error) {
        setAuthMessage('❌ Error verifying authentication');
        console.error('❌ [AUTH GUARD] Failed to parse payload:', error);
      }
    } else {
      setAuthMessage('❌ Not authenticated — redirecting to dashboard');
      
      // Redirect to dashboard after a short delay
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
          🔄 Checking authentication...
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
          Redirecting to dashboard...
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
        Ready to execute transactions
      </div>
      {children}
    </Card>
  );
}

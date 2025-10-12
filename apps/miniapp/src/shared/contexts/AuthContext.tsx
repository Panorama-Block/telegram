'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface AuthContextType {
  user: TelegramUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('telegram_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('telegram_user');
      }
    } else {
      // Check if we have telegram_user_id in URL params
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const telegramUserId = urlParams?.get('telegram_user_id');
      
      if (telegramUserId) {
        // Create a temporary user object from URL params
        const tempUser: TelegramUser = {
          id: parseInt(telegramUserId),
          first_name: 'Telegram User',
          username: `user_${telegramUserId}`,
        };
        
        // Store temporarily (will be replaced by proper login)
        localStorage.setItem('telegram_user', JSON.stringify(tempUser));
        setUser(tempUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async () => {
    try {
      // Get Telegram WebApp data
      const WebApp = (await import('@twa-dev/sdk')).default;

      if (WebApp.initDataUnsafe?.user) {
        const telegramUser: TelegramUser = {
          id: WebApp.initDataUnsafe.user.id,
          first_name: WebApp.initDataUnsafe.user.first_name,
          last_name: WebApp.initDataUnsafe.user.last_name,
          username: WebApp.initDataUnsafe.user.username,
          language_code: WebApp.initDataUnsafe.user.language_code,
          photo_url: WebApp.initDataUnsafe.user.photo_url,
        };

        // Store user data
        localStorage.setItem('telegram_user', JSON.stringify(telegramUser));
        setUser(telegramUser);
      } else {
        // Fallback for development/testing
        const mockUser: TelegramUser = {
          id: Date.now(),
          first_name: 'Test User',
          username: 'testuser',
        };
        localStorage.setItem('telegram_user', JSON.stringify(mockUser));
        setUser(mockUser);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('telegram_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

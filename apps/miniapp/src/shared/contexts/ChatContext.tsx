'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AgentsClient } from '@/clients/agentsClient';
import { useActiveAccount } from 'thirdweb/react';
import { useAuth } from './AuthContext';

export interface Conversation {
  id: string;
  title: string;
}

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  createConversation: () => Promise<string | null>;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  isCreatingConversation: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const LAST_CONVERSATION_STORAGE_KEY = 'chat:lastConversationId';
const CONVERSATION_LIST_KEY = 'chat:ids';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const agentsClient = useMemo(() => new AgentsClient(), []);
  const account = useActiveAccount();
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrappedRef = useRef(false);

  // Get wallet address from localStorage as fallback
  const getWalletAddress = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const authPayload = localStorage.getItem('authPayload');
    if (authPayload) {
      try {
        const payload = JSON.parse(authPayload);
        return payload.address?.toLowerCase();
      } catch (error) {
        console.error('Error parsing authPayload:', error);
      }
    }
    return undefined;
  }, []);

  // Use the currently connected wallet address as the primary userId
  const userId = account?.address?.toLowerCase() || getWalletAddress() || (user?.id ? String(user.id) : undefined);

  const getAuthOptions = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('authToken');
    return token ? { jwt: token } : undefined;
  }, []);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    setActiveConversationIdState(conversationId);
    if (conversationId) {
      try {
        localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, conversationId);
      } catch { }
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const authOpts = getAuthOptions();
      const conversationsFromBackend = await agentsClient.listConversations(userId, authOpts);

      if (!isMountedRef.current) return;

      const mappedConversations: Conversation[] = conversationsFromBackend.map((c, index) => ({
        id: c.id,
        title: c.title || `Chat ${index + 1}`,
      }));

      setConversations(mappedConversations);

      // Cache conversation IDs
      try {
        localStorage.setItem(`${CONVERSATION_LIST_KEY}:${userId}`, JSON.stringify(conversationsFromBackend.map(c => c.id)));
      } catch { }

      // Set active conversation if none selected
      if (!activeConversationId && mappedConversations.length > 0) {
        const storedId = localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);
        if (storedId && conversationsFromBackend.some(c => c.id === storedId)) {
          setActiveConversationId(storedId);
        } else {
          setActiveConversationId(conversationsFromBackend[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      if (isMountedRef.current) {
        setError('Failed to load conversations');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, agentsClient, getAuthOptions, activeConversationId, setActiveConversationId]);

  const createConversation = useCallback(async (): Promise<string | null> => {
    if (!userId || isCreatingConversation) return null;

    setIsCreatingConversation(true);

    try {
      const authOpts = getAuthOptions();
      const newConversationId = await agentsClient.createConversation(userId, authOpts);

      if (!newConversationId || !isMountedRef.current) return null;

      const newConversation: Conversation = {
        id: newConversationId,
        title: 'New Chat',
      };

      setConversations(prev => [newConversation, ...prev]);
      setActiveConversationId(newConversationId);

      return newConversationId;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsCreatingConversation(false);
      }
    }
  }, [userId, agentsClient, getAuthOptions, isCreatingConversation, setActiveConversationId]);

  // Bootstrap on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load conversations when userId is available
  useEffect(() => {
    if (authLoading || !userId || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    refreshConversations();
  }, [authLoading, userId, refreshConversations]);

  // Reset when user changes
  useEffect(() => {
    bootstrappedRef.current = false;
    setConversations([]);
    setActiveConversationIdState(null);
    setIsLoading(true);
    setError(null);
  }, [userId]);

  const value = useMemo(() => ({
    conversations,
    activeConversationId,
    isLoading,
    error,
    createConversation,
    setActiveConversationId,
    refreshConversations,
    isCreatingConversation,
  }), [
    conversations,
    activeConversationId,
    isLoading,
    error,
    createConversation,
    setActiveConversationId,
    refreshConversations,
    isCreatingConversation,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

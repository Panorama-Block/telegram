'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AgentsClient } from '@/clients/agentsClient';
import { useActiveAccount } from 'thirdweb/react';
import { useAuth } from './AuthContext';
import { useWalletIdentity } from './WalletIdentityContext';
import { resolveChatIdentity } from '@/shared/lib/chatIdentity';

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
  deleteConversation: (id: string) => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  isCreatingConversation: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const LAST_CONVERSATION_STORAGE_KEY = 'chat:lastConversationId';
const CONVERSATION_LIST_KEY = 'chat:ids';
const CONVERSATION_CACHE_PREFIX = 'chat:cache';
const AI_TITLE_PREFIX = 'chat:aiTitle';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  const agentsClient = useMemo(() => new AgentsClient(), []);
  const account = useActiveAccount();
  const { user, isLoading: authLoading } = useAuth();
  const { address: identityAddress, tonAddress, tonAddressRaw } = useWalletIdentity();
  const isMountedRef = useRef(true);
  const bootstrappedRef = useRef(false);

  const identity = resolveChatIdentity({
    accountAddress: account?.address,
    identityAddress,
    tonAddress,
    tonAddressRaw,
    telegramUserId: user?.id,
  });
  const userId = identity.userId;

  const getAuthOptions = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('authToken');
    return token ? { jwt: token } : undefined;
  }, []);

  const setActiveConversationId = useCallback((conversationId: string | null) => {
    setActiveConversationIdState(conversationId);
    try {
      if (conversationId) {
        localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, conversationId);
      } else {
        localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
      }
    } catch { }
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const authOpts = getAuthOptions();
      const conversationsFromBackend = await agentsClient.listConversations(userId, authOpts);

      if (!isMountedRef.current) return;

      const mappedConversations: Conversation[] = conversationsFromBackend.map((c, index) => {
        const backendTitle = c.title || `Chat ${index + 1}`;
        if (typeof window !== 'undefined') {
          const t = backendTitle.trim().toLowerCase();
          const isGeneric = !t || t === 'new chat' || t === 'chat' || /^chat\s+\d+$/.test(t);
          if (isGeneric) {
            try {
              const cached = localStorage.getItem(`${AI_TITLE_PREFIX}:${c.id}`);
              if (cached) return { id: c.id, title: cached };
            } catch {}
          }
        }
        return { id: c.id, title: backendTitle };
      });

      setConversations(mappedConversations);

      try {
        localStorage.setItem(
          `${CONVERSATION_LIST_KEY}:${userId}`,
          JSON.stringify(conversationsFromBackend.map(c => c.id))
        );
      } catch { }
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
  }, [userId, agentsClient, getAuthOptions]);

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

  const clearConversationLocalState = useCallback((conversationId: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${AI_TITLE_PREFIX}:${conversationId}`);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`${CONVERSATION_CACHE_PREFIX}:`) && key.endsWith(`:${conversationId}`)) {
          localStorage.removeItem(key);
        }
      });

      if (userId) {
        const listKey = `${CONVERSATION_LIST_KEY}:${userId}`;
        const raw = localStorage.getItem(listKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(
              listKey,
              JSON.stringify(parsed.filter((id) => id !== conversationId))
            );
          }
        }
      }
    } catch (err) {
      console.warn('Failed to clear deleted conversation cache:', err);
    }
  }, [userId]);

  const deleteConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!userId) return;

    const authOpts = getAuthOptions();
    await agentsClient.deleteConversation(userId, conversationId, authOpts);

    if (!isMountedRef.current) return;

    clearConversationLocalState(conversationId);
    setConversations(prev => prev.filter(c => c.id !== conversationId));

    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
    }

    // Re-read the canonical backend list after deletion. If persistence did
    // not actually remove the conversation this will expose the failure
    // instead of leaving a false optimistic state until the next page reload.
    await refreshConversations();
  }, [
    userId,
    agentsClient,
    getAuthOptions,
    clearConversationLocalState,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !userId || bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    refreshConversations();
  }, [authLoading, userId, refreshConversations]);

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
    deleteConversation,
    setActiveConversationId,
    refreshConversations,
    isCreatingConversation,
  }), [
    conversations,
    activeConversationId,
    isLoading,
    error,
    createConversation,
    deleteConversation,
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

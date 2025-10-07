'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sidebar, SignatureApprovalButton } from '@/shared/ui';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import XIcon from '../../../public/icons/X.svg';
import BlockchainTechnology from '../../../public/icons/BlockchainTechnology.svg';
import Briefcase from '../../../public/icons/Briefcase.svg';
import ComboChart from '../../../public/icons/ComboChart.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import WalletIcon from '../../../public/icons/Wallet.svg';
import { AgentsClient } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string | null;
}

interface Conversation {
  id: string;
  title: string;
}

const TRENDING_PROMPTS = [
  "What's the best DeFi strategy for yield farming?",
  "How do I bridge tokens between chains safely?",
  "Explain liquidity pools and impermanent loss",
];

const FEATURE_CARDS = [
  { name: 'Wallet Tracking', icon: WalletIcon, path: null },
  { name: 'AI Agents on X', icon: XIcon, path: null },
  { name: 'Liquid Swap', icon: SwapIcon, path: '/swap' },
  { name: 'Pano View', icon: BlockchainTechnology, path: null },
  { name: 'AI MarketPulse', icon: ComboChart, path: null },
  { name: 'Portfolio', icon: Briefcase, path: null },
];

const MAX_CONVERSATION_TITLE_LENGTH = 48;
const DEBUG_CHAT_FLAG = (process.env.NEXT_PUBLIC_MINIAPP_DEBUG_CHAT ?? process.env.MINIAPP_DEBUG_CHAT ?? '').toLowerCase();
const DEBUG_CHAT_ENABLED = ['1', 'true', 'on', 'yes'].includes(DEBUG_CHAT_FLAG);

function normalizeContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => normalizeContent(part))
      .filter(Boolean)
      .join('');
  }
  if (typeof content === 'object') {
    const anyContent = content as Record<string, unknown>;
    if (typeof anyContent.text === 'string') return anyContent.text;
    if (typeof anyContent.content === 'string') return anyContent.content;
    if (Array.isArray(anyContent.content)) return normalizeContent(anyContent.content);
  }
  return '';
}

function deriveConversationTitle(fallbackTitle: string, messages: Message[]): string {
  const firstUserMessage = messages.find((msg) => msg.role === 'user' && msg.content.trim().length > 0);
  if (!firstUserMessage) return fallbackTitle;

  const normalized = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallbackTitle;

  if (normalized.length > MAX_CONVERSATION_TITLE_LENGTH) {
    return `${normalized.slice(0, MAX_CONVERSATION_TITLE_LENGTH - 3)}...`;
  }

  return normalized;
}

export default function ChatPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [bootstrapVersion, setBootstrapVersion] = useState(0);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);
  const debug = useCallback(
    (event: string, details?: Record<string, unknown>) => {
      if (!DEBUG_CHAT_ENABLED) return;
      const entry = {
        scope: 'ChatPage',
        event,
        timestamp: new Date().toISOString(),
        ...(details ?? {}),
      } satisfies Record<string, unknown>;
      // eslint-disable-next-line no-console
      console.info('[miniapp-debug]', entry);
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;
    debug('component:mount');

    return () => {
      isMountedRef.current = false;
      debug('component:unmount');
    };
  }, [debug]);

  // Use wallet address as userId instead of Telegram user ID
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

  const userId = getWalletAddress() || (user?.id ? String(user.id) : undefined);
  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const isHistoryLoading = loadingConversationId === activeConversationId;

  // Debug userId
  useEffect(() => {
    if (userId) {
      debug('userId:resolved', { userId, source: getWalletAddress() ? 'wallet' : 'telegram' });
    }
  }, [userId, getWalletAddress, debug]);

  const getAuthOptions = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('authToken');
    return token ? { jwt: token } : undefined;
  }, []);

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;
      setLoadingConversationId(conversationId);
      const userKey = userId ?? '__anonymous__';
      debug('messages:load:start', { conversationId, userId: userKey });

      try {
        const authOpts = getAuthOptions();
        const history = await agentsClient.fetchMessages(userId, conversationId, authOpts);
        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) return;

        const mappedHistory: Message[] = history.map((msg) => {
          const parsed = msg.timestamp ? new Date(msg.timestamp) : new Date();
          const timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
          const content = normalizeContent(msg.content);
          return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content,
            timestamp,
            agentName: msg.agent_name ?? null,
          } satisfies Message;
        });

        setInitializationError(null);
        debug('messages:load:success', { conversationId, messages: mappedHistory.length });
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: mappedHistory,
        }));

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, title: deriveConversationTitle(conversation.title, mappedHistory) }
              : conversation
          )
        );
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        debug('messages:load:error', {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
          setInitializationError('We could not load this conversation. Please try again.');
        }
      } finally {
        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) return;
        setLoadingConversationId((current) => (current === conversationId ? null : current));
        debug('messages:load:complete', { conversationId });
      }
    },
    [agentsClient, debug, getAuthOptions, userId]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (messagesByConversation[activeConversationId]) return;
    debug('messages:load:scheduled', { conversationId: activeConversationId });
    loadConversationMessages(activeConversationId);
  }, [activeConversationId, debug, loadConversationMessages, messagesByConversation]);

  useEffect(() => {
    if (authLoading) return;

    const userKey = userId ?? '__anonymous__';
    bootstrapKeyRef.current = userKey;
    setInitializing(true);
    setInitializationError(null);
    debug('bootstrap:start', { userId: userKey });

    const initialise = async () => {
      try {
        const authOpts = getAuthOptions();
        let conversationIds: string[] = [];
        let conversationsRequestFailed = false;

        try {
          conversationIds = await agentsClient.listConversations(userId, authOpts);
          debug('bootstrap:listConversations', { userId: userKey, received: conversationIds.length });
        } catch (error) {
          console.error('Error fetching chat conversations:', error);
          conversationsRequestFailed = true;
          debug('bootstrap:listConversations:error', {
            userId: userKey,
            error: error instanceof Error ? error.message : String(error),
          });
          if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
            setInitializationError('Unable to reach the chat service. Please check your connection and try again.');
          }
        }

        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey)  {
          console.log("return early: ", isMountedRef.current, bootstrapKeyRef.current)
          return;
        }

        if (conversationsRequestFailed) {
          setConversations([]);
          setMessagesByConversation({});
          setActiveConversationId(null);
          debug('bootstrap:abort', { reason: 'listConversationsFailed' });
          return;
        }

        let ensuredConversationId = conversationIds[0] ?? null;

        if (!ensuredConversationId) {
          try {
            ensuredConversationId = await agentsClient.createConversation(userId, authOpts);
            if (ensuredConversationId) {
              conversationIds = [ensuredConversationId, ...conversationIds.filter((id) => id !== ensuredConversationId)];
            }
            debug('bootstrap:createConversation', { ensuredConversationId });
          } catch (error) {
            console.error('Error creating initial conversation:', error);
            debug('bootstrap:createConversation:error', {
              error: error instanceof Error ? error.message : String(error),
            });
            if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
              setInitializationError('We could not start a conversation. Please try again.');
            }
          }
        }

        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) return;

        const mappedConversations: Conversation[] = conversationIds.length > 0
          ? conversationIds.map((id, index) => ({ id, title: `Chat ${index + 1}` }))
          : ensuredConversationId
            ? [{ id: ensuredConversationId, title: 'New Chat' }]
            : [];

        setConversations(mappedConversations);
        setMessagesByConversation({});

        const targetId = ensuredConversationId ?? (conversationIds.length > 0 ? conversationIds[0] : null);
        setActiveConversationId(targetId ?? null);
        debug('bootstrap:targetSelected', { targetId, totalConversations: mappedConversations.length });

        if (targetId) {
          loadConversationMessages(targetId);
        }
      } catch (error) {
        console.error('Error initialising chat:', error);
        debug('bootstrap:error', { error: error instanceof Error ? error.message : String(error) });
        if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
          setInitializationError('Something went wrong while loading your chat. Please try again.');
        }
      } finally {
        if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
          setInitializing(false);
          debug('bootstrap:complete', { hasError: Boolean(initializationError) });
        }
      }
    };

    initialise();
  }, [agentsClient, authLoading, bootstrapVersion, debug, getAuthOptions, loadConversationMessages, userId]);

  const retryBootstrap = useCallback(() => {
    debug('bootstrap:retry');
    setBootstrapVersion((prev) => prev + 1);
  }, [debug]);

  const sendMessage = async (content?: string) => {
    const messageContent = content ?? inputMessage.trim();
    if (!messageContent || isSending || !activeConversationId) return;

    const conversationId = activeConversationId;
    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    const existingMessages = messagesByConversation[conversationId] ?? [];
    const updatedMessages = [...existingMessages, userMessage];

    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: updatedMessages,
    }));

    setConversations((prev) => {
      const ensureConversationExists = prev.some((conversation) => conversation.id === conversationId)
        ? prev
        : [{ id: conversationId, title: 'New Chat' }, ...prev];

      return ensureConversationExists.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: deriveConversationTitle(conversation.title, updatedMessages) }
          : conversation
      );
    });

    setInputMessage('');
    setIsSending(true);

    try {
      debug('chat:send', { conversationId, hasMetadata: Boolean(userId) });
      const response = await agentsClient.chat(
        {
          message: { role: 'user', content: messageContent },
          user_id: userId,
          conversation_id: conversationId,
          metadata: {
            source: 'miniapp-chat',
            sent_at: new Date().toISOString(),
          },
        },
        getAuthOptions()
      );

      if (!isMountedRef.current) return;

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || 'I was unable to process that request.',
        timestamp: new Date(),
        agentName: response.agent_name ?? null,
      };

      setMessagesByConversation((prev) => {
        const prevMessages = prev[conversationId] ?? [];
        return {
          ...prev,
          [conversationId]: [...prevMessages, assistantMessage],
        };
      });
    } catch (error) {
      console.error('Error sending message:', error);
      debug('chat:error', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallbackContent =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'The agent is taking longer than expected. Please wait a moment and try again.'
          : 'Sorry, I could not get a response right now. Please try again in a moment.';

      const fallbackMessage: Message = {
        role: 'assistant',
        content: fallbackContent,
        timestamp: new Date(),
      };

      if (isMountedRef.current) {
        setMessagesByConversation((prev) => {
          const prevMessages = prev[conversationId] ?? [];
          return {
            ...prev,
            [conversationId]: [...prevMessages, fallbackMessage],
          };
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
      debug('chat:complete', { conversationId });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createNewChat = async () => {
    if (isCreatingConversation) return;

    setIsCreatingConversation(true);

    try {
      const newConversationId = await agentsClient.createConversation(userId, getAuthOptions());
      if (!newConversationId || !isMountedRef.current) return;

      const newConversation: Conversation = {
        id: newConversationId,
        title: 'New Chat',
      };

      setConversations((prev) => [newConversation, ...prev.filter((conversation) => conversation.id !== newConversationId)]);
      setMessagesByConversation((prev) => ({
        ...prev,
        [newConversationId]: [],
      }));
      setInitializationError(null);
      setActiveConversationId(newConversationId);
      debug('conversation:create:success', { newConversationId });
    } catch (error) {
      console.error('Error creating chat conversation:', error);
      debug('conversation:create:error', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (isMountedRef.current) {
        setInitializationError('We could not create a new chat. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingConversation(false);
        debug('conversation:create:complete');
      }
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setInitializationError(null);
    setSidebarOpen(false);
    debug('conversation:select', { conversationId });
  };

  const handleSignatureApproval = useCallback(async () => {
    console.log('✅ Signature approved');
  }, []);

  const handleSignatureRejection = useCallback(async () => {
    console.log('❌ Signature rejected');
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex">
      {/* Left Sidebar with Chat Conversations */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed top-0 left-0 h-screen w-80 bg-[#0d1117] border-r border-cyan-500/20 z-50 overflow-y-auto flex flex-col">
            {/* Header with logo - Fixed */}
            <div className="flex-shrink-0 p-4 border-b border-cyan-500/20 flex items-center justify-between">
              <Image
                src={zicoBlue}
                alt="Zico"
                width={32}
                height={32}
              />
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Navigation Menu */}
              <nav className="p-4 space-y-2 border-b border-cyan-500/20">
                <button
                  onClick={() => {
                    router.push('/chat');
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="font-medium">Chat</span>
                </button>
                <button
                  onClick={() => {
                    router.push('/swap');
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span className="font-medium">Swap</span>
                </button>
              </nav>

              {/* New Chat Button */}
              <div className="px-4 mt-4 mb-6">
                <button
                  onClick={createNewChat}
                  disabled={isCreatingConversation}
                  className="w-full px-4 py-3 rounded-lg border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingConversation ? 'Creating...' : 'New Chat'}
                </button>
              </div>

              {/* Past Conversations (Last 5) */}
              <div className="px-4 mb-6">
                <h3 className="text-gray-400 text-sm font-semibold mb-2">Recent Conversations</h3>
                {conversations.slice(0, 5).map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all text-left ${
                      conv.id === activeConversationId
                        ? 'bg-gray-800 border border-cyan-500/40 text-white'
                        : 'text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-sm">{conv.title}</span>
                  </button>
                ))}
              </div>

              {/* Trending Prompts */}
              <div className="px-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-cyan-400">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="text-white font-semibold">Trending Prompts</h3>
                </div>
                {TRENDING_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(prompt)}
                    disabled={!activeConversationId || isSending}
                    className="w-full text-left px-4 py-3 mb-2 rounded-lg bg-gray-800/50 text-gray-300 hover:bg-gray-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Disconnect Button */}
              <div className="px-4 pb-6">
                <button
                  onClick={async () => {
                    try {
                      // Clear all auth data
                      localStorage.removeItem('authToken');
                      localStorage.removeItem('authPayload');
                      localStorage.removeItem('authSignature');
                      localStorage.removeItem('telegram_user');

                      // Close sidebar
                      setSidebarOpen(false);

                      // Small delay to ensure localStorage is cleared
                      await new Promise(resolve => setTimeout(resolve, 100));

                      // Force page reload to clear all state (basePath is /miniapp)
                      window.location.href = '/miniapp';
                    } catch (error) {
                      console.error('Error disconnecting:', error);
                      // Force redirect anyway
                      window.location.href = '/miniapp';
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20 hover:border-red-500/50"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Disconnect</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - Fixed */}
        <div className="sticky top-0 z-30 bg-[#0d1117] border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <Image src={zicoBlue} alt="Zico" width={32} height={32} />
          </div>

          <div className="w-6"></div>
        </div>

        {/* Messages or Empty State */}
        <div className="flex-1 overflow-y-auto">
          {initializing ? (
            <div className="h-full flex items-center justify-center px-4 py-12 text-center">
              {initializationError ? (
                <div className="space-y-4">
                  <p className="text-gray-300">{initializationError}</p>
                  <button
                    onClick={retryBootstrap}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-cyan-500 text-white hover:bg-cyan-600 transition-all"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <p className="text-gray-400">Loading your conversations...</p>
              )}
            </div>
          ) : !activeConversationId ? (
            <div className="h-full flex items-center justify-center px-4 py-12">
              <p className="text-gray-400">Create a new chat to get started.</p>
            </div>
          ) : initializationError && activeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-12 text-center space-y-4">
              <p className="text-gray-300">{initializationError}</p>
              <button
                onClick={retryBootstrap}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-cyan-500 text-white hover:bg-cyan-600 transition-all"
              >
                Try again
              </button>
            </div>
          ) : isHistoryLoading && activeMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4 py-12">
              <p className="text-gray-400">Loading conversation...</p>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-300 mb-12">
                Select a Feature or Start a Chat
              </h2>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-3 gap-4 max-w-md mb-8">
                {FEATURE_CARDS.map((feature, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (feature.path) {
                        router.push(feature.path);
                      }
                    }}
                    disabled={!feature.path}
                    className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-gray-800/30 backdrop-blur-md hover:bg-gray-800/50 border border-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-lg hover:shadow-cyan-500/20 ${
                      !feature.path ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <Image
                      src={feature.icon}
                      alt={feature.name}
                      width={32}
                      height={32}
                      className="w-8 h-8"
                    />
                    <span className="text-xs text-gray-400 text-center">{feature.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 space-y-4">
              {activeMessages.map((message, index) => {
                const timestampValue = message.timestamp.getTime();
                const hasValidTime = !Number.isNaN(timestampValue);
                const timeLabel = hasValidTime
                  ? message.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                const messageKey = hasValidTime
                  ? `${message.role}-${timestampValue}-${index}`
                  : `${message.role}-${index}`;

                return (
                  <div
                    key={messageKey}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-800 text-gray-200'
                      }`}
                    >
                      {message.role === 'assistant' && message.agentName ? (
                        <p className="text-xs font-semibold text-cyan-300 mb-1">{message.agentName}</p>
                      ) : null}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.content.toLowerCase().includes('swapped') && message.role === 'assistant' && (
                        <SignatureApprovalButton
                          onApprove={handleSignatureApproval}
                          onReject={handleSignatureRejection}
                          disabled={isSending}
                        />
                      )}
                      {timeLabel ? (
                        <p className="text-xs opacity-60 mt-1">{timeLabel}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 text-gray-200 px-4 py-3 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-75" />
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - Fixed */}
        <div className="sticky bottom-0 z-30 bg-[#0d1117] border-t border-cyan-500/20 p-4">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isSending || !activeConversationId || initializing}
              className="flex-1 px-4 py-3 rounded-full bg-gray-800 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!inputMessage.trim() || isSending || !activeConversationId || initializing}
              className="p-3 rounded-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Paperclip, ArrowUp, ArrowDown, Sparkles, ArrowLeftRight, PieChart, Landmark, Percent, ArrowRightLeft, TrendingUp } from 'lucide-react';

// Window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
import { GlobalLoader, TransactionSettingsProvider } from '@/shared/ui';
import MarkdownMessage from '@/shared/ui/MarkdownMessage';
import Image from 'next/image';
import '../../shared/ui/loader.css';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import { AgentsClient } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { swapApi } from '@/features/swap/api';
import { Lending } from '@/components/Lending';
import { normalizeToApi, formatAmountHuman } from '@/features/swap/utils';
import { networks, Token } from '@/features/swap/tokens';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { useLogout } from '@/shared/hooks/useLogout';
import { createThirdwebClient } from 'thirdweb';
import type { QuoteResponse } from '@/features/swap/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SeniorAppShell } from '@/components/layout';
import { SwapWidget } from '@/components/SwapWidget';
import { Staking } from '@/components/Staking';
import { Droplets } from 'lucide-react';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface Conversation {
  id: string;
  title: string;
}

const MAX_CONVERSATION_TITLE_LENGTH = 48;
const DEBUG_CHAT_FLAG = (process.env.NEXT_PUBLIC_MINIAPP_DEBUG_CHAT ?? process.env.MINIAPP_DEBUG_CHAT ?? '').toLowerCase();
const DEBUG_CHAT_ENABLED = ['1', 'true', 'on', 'yes'].includes(DEBUG_CHAT_FLAG);

// Helper functions to map metadata to tokens and networks
function getNetworkByName(networkName: string) {
  const networkMap: Record<string, number> = {
    'ethereum': 1,
    'avalanche': 43114,
    'base': 8453,
    'arbitrum': 42161,
    'polygon': 137,
    'bsc': 56,
    'optimism': 10,
  };

  const chainId = networkMap[networkName.toLowerCase()];
  return networks.find(n => n.chainId === chainId);
}

function getTokenBySymbol(symbol: string, chainId: number): Token | null {
  const network = networks.find(n => n.chainId === chainId);
  if (!network) return null;

  return network.tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}

// Helper to convert chat metadata to SwapWidget token format
function metadataToSwapTokens(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const fromNetwork = getNetworkByName(metadata.from_network as string);
  const toNetwork = getNetworkByName(metadata.to_network as string);

  if (!fromNetwork || !toNetwork) return null;

  const fromToken = fromNetwork.tokens.find(
    t => t.symbol.toUpperCase() === (metadata.from_token as string).toUpperCase()
  );
  const toToken = toNetwork.tokens.find(
    t => t.symbol.toUpperCase() === (metadata.to_token as string).toUpperCase()
  );

  const networkNameMap: Record<number, string> = {
    1: 'Ethereum',
    43114: 'Avalanche',
    8453: 'Base',
    42161: 'Arbitrum',
    137: 'Polygon',
    56: 'Binance Smart Chain',
    10: 'Optimism',
    480: 'World Chain',
  };

  return {
    from: fromToken ? {
      ticker: fromToken.symbol,
      name: fromToken.name || fromToken.symbol,
      network: networkNameMap[fromNetwork.chainId] || fromNetwork.name,
      address: fromToken.address,
      balance: '0.00',
    } : null,
    to: toToken ? {
      ticker: toToken.symbol,
      name: toToken.name || toToken.symbol,
      network: networkNameMap[toNetwork.chainId] || toNetwork.name,
      address: toToken.address,
      balance: '0.00',
    } : null,
    amount: metadata.amount as string,
  };
}

function normalizeContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => normalizeContent(part))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'object') {
    const anyContent = content as Record<string, unknown>;
    if (typeof anyContent.text === 'string') return anyContent.text;
    if (typeof anyContent.content === 'string') return anyContent.content;
    if (Array.isArray(anyContent.content)) return normalizeContent(anyContent.content);
  }
  return '';
}

// Fallback formatter: when agent returns compact text with inline "* " bullets or headings
function autoFormatAssistantMarkdown(text: string): string {
  if (!text) return '';
  let t = String(text).replace(/\r\n/g, '\n');

  // Ensure blank lines around headings
  t = t.replace(/\s*##\s/g, '\n\n## ');

  // Convert ": * Item" or ". * Item" into new line bullets
  t = t.replace(/([:\.!?])\s*\*\s+/g, '$1\n- ');

  // Convert hyphen bullets written inline after punctuation (". - Item")
  t = t.replace(/([:\.!?])\s*[-–—]\s+/g, '$1\n- ');

  // If there are many inline asterisks that look like bullets, split them
  if (/\*\s+[A-Za-z0-9]/.test(t) && !/\n-\s/.test(t)) {
    t = t.replace(/\s\*\s+/g, '\n- ');
  }

  // If inline hyphens are used as bullets with spaces (" - "), split them
  if (/\s-\s+[A-Za-z0-9]/.test(t) && !/\n-\s/.test(t)) {
    t = t.replace(/\s-\s+/g, '\n- ');
  }

  // Normalize list dash to leading position when preceded by start of text
  t = t.replace(/^\*\s+/gm, '- ');

  // Collapse excessive blank lines
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
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
  const searchParams = useSearchParams();
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationType, setNavigationType] = useState<'swap' | 'lending' | 'staking' | 'dca' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);
  const lastBootstrapTimeRef = useRef<number>(0);

  // Thirdweb setup
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { logout } = useLogout();
  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  // Swap states
  const [swapQuote, setSwapQuote] = useState<QuoteResponse | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // SwapWidget modal state
  const [showSwapWidget, setShowSwapWidget] = useState(false);
  const [swapWidgetTokens, setSwapWidgetTokens] = useState<{ from: any; to: any; amount?: string } | null>(null);

  // Lending states
  const [lendingModalOpen, setLendingModalOpen] = useState(false);
  const [currentLendingMetadata, setCurrentLendingMetadata] = useState<Record<string, unknown> | null>(null);

  // Staking states
  const [showStakingWidget, setShowStakingWidget] = useState(false);
  const [currentStakingMetadata, setCurrentStakingMetadata] = useState<Record<string, unknown> | null>(null);

  // Trending prompts state
  const [showTrendingPrompts, setShowTrendingPrompts] = useState(false);
  const trendingPrompts = [
    { icon: <ArrowLeftRight className="w-4 h-4" />, text: 'Swap 0.1 ETH to USDC on Base' },
    { icon: <Landmark className="w-4 h-4" />, text: 'Supply 100 USDC on Avalanche' },
    { icon: <Droplets className="w-4 h-4" />, text: 'Stake 0.5 ETH with Lido' },
    { icon: <PieChart className="w-4 h-4" />, text: 'What is my portfolio worth?' },
  ];

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

  const handleWalletDisconnect = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    isMountedRef.current = true;
    debug('component:mount');

    // Force fresh start on mount - clear old state
    setConversations([]);
    setMessagesByConversation({});
    setActiveConversationId(null);
    setSwapQuote(null);
    setSwapError(null);
    lastBootstrapTimeRef.current = Date.now();

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

  // CRITICAL: Use the currently connected wallet address as the primary userId
  // This ensures each user sees only their own chats, even on shared devices
  const userId = account?.address?.toLowerCase() || getWalletAddress() || (user?.id ? String(user.id) : undefined);
  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const isHistoryLoading = loadingConversationId === activeConversationId;
  const hasMessages = activeMessages.length > 0;
  const displayName = useMemo(() => {
    const address = account?.address || getWalletAddress();
    if (address) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return 'User';
  }, [account?.address, getWalletAddress]);

  // Debug userId
  useEffect(() => {
    if (userId) {
      const source = account?.address ? 'connected-wallet' : getWalletAddress() ? 'localStorage-wallet' : 'telegram';
      debug('userId:resolved', { userId, source, connectedWallet: account?.address });
      console.log('🔐 [CHAT] Using userId:', userId, '| Source:', source);
    } else {
      console.warn('⚠️ [CHAT] No userId available - chat will not load');
    }
  }, [userId, account?.address, getWalletAddress, debug]);

  // Clear chat state when wallet changes to prevent showing previous user's data
  useEffect(() => {
    const currentUserId = account?.address?.toLowerCase() || getWalletAddress();
    if (currentUserId && bootstrapKeyRef.current && bootstrapKeyRef.current !== currentUserId && bootstrapKeyRef.current !== '__anonymous__') {
      console.log('🔄 [CHAT] Wallet changed, clearing previous user data');
      setConversations([]);
      setMessagesByConversation({});
      setActiveConversationId(null);
      setInitializationError(null);
      // Bootstrap will be triggered by the useEffect below
    }
  }, [account?.address, getWalletAddress]);

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
          const raw = normalizeContent(msg.content);
          const content = msg.role === 'assistant' ? autoFormatAssistantMarkdown(raw) : raw;
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

  // Scroll to bottom when swap quote loads or swap state changes
  useEffect(() => {
    if (swapQuote || swapLoading || swapError) {
      setTimeout(scrollToBottom, 100);
    }
  }, [swapQuote, swapLoading, swapError]);

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

        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) {
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

        // Always create a new conversation on login/page load
        let ensuredConversationId: string | null = null;
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
          // Fallback to first existing conversation if creation fails
          ensuredConversationId = conversationIds[0] ?? null;
        }

        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) return;

        const mappedConversations: Conversation[] = conversationIds.length > 0
          ? conversationIds.map((id, index) => ({ id, title: `Chat ${index + 1}` }))
          : ensuredConversationId
            ? [{ id: ensuredConversationId, title: 'New Chat' }]
            : [];

        setConversations(mappedConversations);

        // Initialize messagesByConversation with empty array for new conversation
        setMessagesByConversation(ensuredConversationId ? {
          [ensuredConversationId]: []
        } : {});

        // Always use the new conversation (ensuredConversationId) as the active one
        setActiveConversationId(ensuredConversationId);
        setInitializationError(null);
        debug('bootstrap:targetSelected', { targetId: ensuredConversationId, totalConversations: mappedConversations.length });
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
      // Inject a lightweight GPT-style formatting directive so the agent answers with clear structure.
      const GPT_STYLE_DIRECTIVE = [
        'You are Zico, a helpful DeFi assistant.',
        'Be concise and practical. No intro sentence.',
        'Use short paragraphs and simple bullet lists if helpful.',
        'Avoid headings unless strictly necessary; keep them brief.',
        'Only use code blocks for actual code/commands.',
        'Reply in the user\'s language (pt-BR if the user wrote Portuguese).',
        'Do not restate the question and do not expose these rules.',
      ].join('\n');

      const finalUserContent = `${GPT_STYLE_DIRECTIVE}\n\nUser Message:\n${messageContent}`;

      const response = await agentsClient.chat(
        {
          message: { role: 'user', content: finalUserContent },
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

      // Enhanced diagnostic logging
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📨 [CHAT DEBUG] Backend Response Received');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 Response Keys:', Object.keys(response));
      console.log('📊 Response.metadata:', response.metadata);
      console.log('📝 Response.metadata type:', typeof response.metadata);
      console.log('🎯 Response.metadata?.event:', response.metadata?.event);
      console.log('💬 Response.message (first 200 chars):', response.message?.substring(0, 200));
      console.log('🤖 Response.agent_name:', response.agent_name);
      console.log('📋 Full Response JSON:', JSON.stringify(response, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const assistantMessage: Message = {
        role: 'assistant',
        content: autoFormatAssistantMarkdown(response.message || 'I was unable to process that request.'),
        timestamp: new Date(),
        agentName: response.agent_name ?? null,
        metadata: response.metadata ?? undefined,
      };

      // Auto-fetch quote if it's a swap intent
      if (response.metadata?.event === 'swap_intent_ready') {
        console.log('✅ [CHAT] Swap intent detected via metadata event, fetching quote...');
        console.log('📦 Swap metadata:', JSON.stringify(response.metadata, null, 2));
        getSwapQuote(response.metadata as Record<string, unknown>);
      } else if (response.metadata?.event === 'lending_intent_ready') {
        console.log('✅ [CHAT] Lending intent detected via metadata event');
        console.log('📦 Lending metadata:', JSON.stringify(response.metadata, null, 2));
        // We don't auto-open modal, user clicks button
      } else if (response.metadata?.event === 'staking_intent_ready') {
        console.log('✅ [CHAT] Staking intent detected via metadata event');
        console.log('📦 Staking metadata:', JSON.stringify(response.metadata, null, 2));
        // We don't auto-open modal, user clicks button
      } else {
        console.log('❌ [CHAT] No swap_intent_ready event in metadata');

        // Enhanced fallback detection
        const messageContent = response.message?.toLowerCase() || '';
        const hasSwapKeywords = messageContent.includes('swap') || messageContent.includes('troca');
        const hasConfirmKeywords = messageContent.includes('confirm') || messageContent.includes('confirme');

        if (hasSwapKeywords && hasConfirmKeywords) {
          console.log('⚠️ [SWAP FALLBACK] Detected swap keywords in message but metadata is missing or invalid');
          console.log('⚠️ Message snippet:', response.message?.substring(0, 300));
          console.log('⚠️ This indicates the backend should have returned swap metadata but didn\'t');
          console.log('⚠️ Check backend logs to see why metadata.event is not "swap_intent_ready"');
        }

        // Check if metadata exists but has wrong event
        if (response.metadata && response.metadata.event !== 'swap_intent_ready') {
          console.log('⚠️ [METADATA MISMATCH] Metadata exists but event is not swap_intent_ready');
          console.log('⚠️ Actual event:', response.metadata.event);
          console.log('⚠️ Full metadata:', JSON.stringify(response.metadata, null, 2));
        }

        // Check if metadata is completely null/undefined
        if (!response.metadata) {
          console.log('⚠️ [NO METADATA] Backend returned null/undefined metadata');
          console.log('⚠️ This usually means:');
          console.log('   1. Backend is not detecting the swap intent');
          console.log('   2. Backend is not including metadata in the response');
          console.log('   3. There was an error processing the request on the backend');
        }
      }

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
    debug('conversation:select', { conversationId });
  };

  // Handle ?new=true query parameter to create new chat
  const newChatRequested = searchParams.get('new') === 'true';
  const newChatTriggeredRef = useRef(false);

  useEffect(() => {
    if (newChatRequested && !initializing && !isCreatingConversation && userId && !newChatTriggeredRef.current) {
      console.log('[CHAT] Creating new chat from URL param...');
      newChatTriggeredRef.current = true;
      router.replace('/chat', { scroll: false });
      createNewChat();
    }

    if (!newChatRequested) {
      newChatTriggeredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatRequested, initializing, isCreatingConversation, userId]);

  // Listen for custom event from sidebar "+" button
  useEffect(() => {
    const handleNewChatEvent = () => {
      console.log('[CHAT] New chat event received');
      if (!initializing && !isCreatingConversation && userId) {
        createNewChat();
      }
    };

    window.addEventListener('panorama:newchat', handleNewChatEvent);
    return () => window.removeEventListener('panorama:newchat', handleNewChatEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, isCreatingConversation, userId]);

  // Function to get quote based on message metadata
  const getSwapQuote = useCallback(async (metadata: Record<string, unknown>) => {
    if (!metadata || typeof metadata !== 'object') {
      console.error('❌ Invalid metadata for swap quote');
      return;
    }

    const { amount, from_network, from_token, to_network, to_token } = metadata;

    console.log('📊 Getting swap quote with metadata:', { amount, from_network, from_token, to_network, to_token });

    if (!amount || !from_network || !from_token || !to_network || !to_token) {
      const errorMsg = 'Invalid swap metadata - missing required fields';
      console.error('❌', errorMsg, { amount, from_network, from_token, to_network, to_token });
      setSwapError(errorMsg);
      return;
    }

    // Get networks by name
    const fromNetwork = getNetworkByName(from_network as string);
    const toNetwork = getNetworkByName(to_network as string);

    if (!fromNetwork || !toNetwork) {
      const errorMsg = `Unsupported network: ${from_network} or ${to_network}`;
      console.error('❌', errorMsg);
      setSwapError(errorMsg);
      return;
    }

    // Get tokens by symbol
    const fromToken = getTokenBySymbol(from_token as string, fromNetwork.chainId);
    const toToken = getTokenBySymbol(to_token as string, toNetwork.chainId);

    if (!fromToken || !toToken) {
      const errorMsg = `Token not found: ${from_token} or ${to_token}`;
      console.error('❌', errorMsg);
      setSwapError(errorMsg);
      return;
    }

    try {
      setSwapLoading(true);
      setSwapError(null);
      console.log('🔄 Fetching quote...');

      const addressFromToken = getWalletAddress();
      const userAddress = localStorage.getItem('userAddress');
      const effectiveAddress = account?.address || addressFromToken || userAddress;

      console.log('📍 Using address:', effectiveAddress);

      const quoteResponse = await swapApi.quote({
        fromChainId: fromNetwork.chainId,
        toChainId: toNetwork.chainId,
        fromToken: normalizeToApi(fromToken.address),
        toToken: normalizeToApi(toToken.address),
        amount: String(amount),
        smartAccountAddress: effectiveAddress || undefined,
      });

      console.log('📈 Quote response:', quoteResponse);

      if (quoteResponse.success && quoteResponse.quote) {
        setSwapQuote(quoteResponse);
        console.log('✅ Quote received successfully');
      } else {
        const errorMsg = quoteResponse.message || 'Failed to get quote';
        console.error('❌ Quote failed:', errorMsg);
        setSwapError(errorMsg);
      }
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      setSwapError(error instanceof Error ? error.message : 'Failed to get quote');
    } finally {
      setSwapLoading(false);
    }
  }, [account?.address, getWalletAddress]);

  return (
    <ProtectedRoute>
      <TransactionSettingsProvider>
        <GlobalLoader isLoading={initializing && !initializationError} message="Setting up your workspace..." />
        <GlobalLoader
          isLoading={isNavigating}
          message={
            navigationType === 'lending' ? 'Loading Lending...' :
              navigationType === 'staking' ? 'Loading Staking...' :
                navigationType === 'swap' ? 'Loading Swap...' :
                  navigationType === 'dca' ? 'Loading DCA...' :
                    'Loading...'
          }
        />

        <SeniorAppShell pageTitle="Zico AI Agent">
          <div className="flex flex-col h-full relative bg-black">
            {/* Ambient God Ray */}
            <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 via-slate-900/5 to-black blur-3xl pointer-events-none z-0" />

            <div className="flex-1 overflow-y-auto z-10 scrollbar-hide flex flex-col">
              {initializing ? (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                  Loading your conversations...
                </div>
              ) : !activeConversationId ? (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                  Crie um novo chat para começar.
                </div>
              ) : initializationError && !hasMessages ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center min-h-[50vh]">
                  <p className="text-zinc-400">{initializationError}</p>
                  <button
                    onClick={retryBootstrap}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                  >
                    Try again
                  </button>
                </div>
              ) : isHistoryLoading && !hasMessages ? (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                  Loading conversation...
                </div>
              ) : !hasMessages ? (
                <div className="flex-1 flex flex-col justify-start items-center w-full pb-safe pb-6 md:pb-4 pt-20 md:pt-[15vh] px-4 overflow-y-auto">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-3xl text-center flex flex-col items-center"
                  >
                    {/* Title & Subtitle */}
                    <div className="space-y-2 md:space-y-4 relative mb-8">
                      <h1 className="text-4xl md:text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 pb-2 leading-tight tracking-tight">
                        Hello, {displayName}.
                      </h1>
                      <p className="text-xl text-zinc-400 font-light">
                        Zico is ready to navigate the chain.
                      </p>
                    </div>

                    {/* Main Input Area */}
                    <div className="relative group max-w-2xl mx-auto w-full my-8">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                      <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 md:p-2 flex items-center gap-2 md:gap-4 shadow-2xl group-focus-within:ring-1 group-focus-within:ring-cyan-500/30 group-focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-300">
                        <div className="pl-2 md:pl-4 text-zinc-400">
                          <Search className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Ask Zico anything..."
                          disabled={isSending || !activeConversationId || initializing}
                          className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-zinc-600 placeholder:text-sm md:placeholder:text-lg h-12 md:h-14"
                        />
                        <div className="flex items-center gap-2 pr-1 md:pr-2">
                          <button className="hidden md:block p-3 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => sendMessage()}
                            disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                            className="p-2 md:p-3 bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Send message"
                          >
                            <ArrowUp className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Suggestions Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 w-full md:w-auto mt-6">
                      {[
                        { label: 'Swap 0.1 ETH to USDC on Base', prompt: 'Swap 0.1 ETH to USDC on Base' },
                        { label: 'Supply 100 USDC on Avalanche', prompt: 'Supply 100 USDC on Avalanche' },
                        { label: 'Stake 0.5 ETH with Lido', prompt: 'Stake 0.5 ETH with Lido' },
                        { label: 'What is my portfolio worth?', prompt: 'What is my portfolio worth?' },
                      ].map((item, i) => (
                        <motion.button
                          key={item.label}
                          onClick={() => sendMessage(item.prompt)}
                          disabled={isSending || !activeConversationId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + (i * 0.1) }}
                          className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-cyan-400/50 transition-all duration-300 group text-left shadow-sm hover:shadow-[0_0_15px_rgba(34,211,238,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                          <span className="text-sm text-zinc-400 group-hover:text-zinc-200">{item.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto w-full pt-8 pb-4 px-4 space-y-8">
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
                      <motion.div
                        key={messageKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'user' ? (
                          <div className="max-w-[80%] bg-zinc-800/80 backdrop-blur-sm text-white px-6 py-4 rounded-2xl rounded-tr-sm border border-white/5 shadow-lg">
                            <p className="text-base leading-relaxed">{message.content}</p>
                          </div>
                        ) : (
                          <div className="flex gap-4 max-w-[90%]">
                            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(34,211,238,0.3)] overflow-hidden p-1">
                              <Image src={zicoBlue} alt="Zico" width={24} height={24} className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                            </div>
                            <div className="space-y-4">
                              <div className="text-zinc-100 text-base leading-relaxed">
                                <MarkdownMessage text={message.content} />
                              </div>

                                {message.metadata?.event === 'swap_intent_ready' && (
                                  <div className="mt-4 w-full max-w-sm">
                                    {/* Swap Card - SwapWidget Style */}
                                    <div className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                      {/* Gradient Glow */}
                                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-cyan-500/10 blur-[40px] pointer-events-none" />

                                      {/* Header */}
                                      <div className="relative z-10 px-4 py-3 border-b border-white/5 flex items-center gap-2">
                                        <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                                        <span className="text-sm font-semibold text-white">Swap</span>
                                        {swapLoading && <div className="loader-inline-sm ml-auto" />}
                                      </div>

                                      {/* Content */}
                                      <div className="relative z-10 p-4 space-y-3">
                                        {/* From Token */}
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Sell</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xl font-medium text-white">{String(message.metadata?.amount)}</span>
                                            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-2.5 py-1">
                                              <div className="w-5 h-5 rounded-full bg-zinc-600 flex items-center justify-center text-[9px] text-white font-bold">
                                                {String(message.metadata?.from_token)?.[0]}
                                              </div>
                                              <span className="text-sm font-medium text-white">{String(message.metadata?.from_token)}</span>
                                            </div>
                                          </div>
                                          <div className="text-[10px] text-zinc-500 mt-1">{String(message.metadata?.from_network)}</div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex justify-center -my-1">
                                          <div className="bg-[#0A0A0A] border border-white/10 p-1.5 rounded-lg">
                                            <ArrowDown className="w-4 h-4 text-cyan-400" />
                                          </div>
                                        </div>

                                        {/* To Token */}
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Buy</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xl font-medium text-white">
                                              {swapLoading ? '...' : swapQuote?.quote ? formatAmountHuman(BigInt(swapQuote.quote.estimatedReceiveAmount || 0), 18) : '~'}
                                            </span>
                                            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-2.5 py-1">
                                              <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[9px] text-white font-bold">
                                                {String(message.metadata?.to_token)?.[0]}
                                              </div>
                                              <span className="text-sm font-medium text-white">{String(message.metadata?.to_token)}</span>
                                            </div>
                                          </div>
                                          <div className="text-[10px] text-zinc-500 mt-1">{String(message.metadata?.to_network)}</div>
                                        </div>

                                        {/* Error Message */}
                                        {swapError && !swapLoading && (
                                          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                                            <p className="text-xs text-red-300">{swapError}</p>
                                          </div>
                                        )}

                                        {/* Action Button */}
                                        <button
                                          onClick={() => {
                                            const tokens = metadataToSwapTokens(message.metadata as Record<string, unknown>);
                                            if (tokens) {
                                              setSwapWidgetTokens(tokens);
                                              setShowSwapWidget(true);
                                            }
                                          }}
                                          disabled={swapLoading || !swapQuote?.quote}
                                          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                        >
                                          {swapLoading ? 'Getting best price...' : 'Review Swap'}
                                        </button>
                                      </div>

                                      {/* Footer */}
                                      <div className="relative z-10 px-4 py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[#ff007a]/20 flex items-center justify-center">
                                          <span className="text-[10px]">🦄</span>
                                        </div>
                                        <span className="text-[10px] text-zinc-500">Powered by Uniswap</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {message.metadata?.event === 'lending_intent_ready' && (
                                  <div className="mt-4 w-full max-w-sm">
                                    {/* Lending Card - SwapWidget Style */}
                                    <div className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                      {/* Gradient Glow */}
                                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-cyan-500/10 blur-[40px] pointer-events-none" />

                                      {/* Header */}
                                      <div className="relative z-10 px-4 py-3 border-b border-white/5 flex items-center gap-2">
                                        <Landmark className="w-5 h-5 text-cyan-400" />
                                        <span className="text-sm font-semibold text-white">Lending</span>
                                        <span className="ml-auto px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-medium rounded-full border border-cyan-500/30">
                                          {String(message.metadata?.action || 'Supply').toUpperCase()}
                                        </span>
                                      </div>

                                      {/* Content */}
                                      <div className="relative z-10 p-4 space-y-3">
                                        {/* Amount Card */}
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                                              {String(message.metadata?.action || 'Supply')}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xl font-medium text-white">
                                              {String(message.metadata?.amount || '0')}
                                            </span>
                                            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-2.5 py-1">
                                              <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[9px] text-white font-bold">
                                                {String(message.metadata?.asset || message.metadata?.token || 'T')?.[0]}
                                              </div>
                                              <span className="text-sm font-medium text-white">
                                                {String(message.metadata?.asset || message.metadata?.token || 'Token')}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-[10px] text-zinc-500 mt-1">
                                            {String(message.metadata?.network || 'Avalanche')}
                                          </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                          onClick={() => {
                                            setCurrentLendingMetadata(message.metadata as Record<string, unknown>);
                                            setLendingModalOpen(true);
                                          }}
                                          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm transition-all hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                        >
                                          Review {String(message.metadata?.action || 'Supply')}
                                        </button>
                                      </div>

                                      {/* Footer */}
                                      <div className="relative z-10 px-4 py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                          <Landmark className="w-3 h-3 text-cyan-400" />
                                        </div>
                                        <span className="text-[10px] text-zinc-500">Powered by Benqi</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {message.metadata?.event === 'staking_intent_ready' && (
                                  <div className="mt-4 w-full max-w-sm">
                                    {/* Staking Card - SwapWidget Style */}
                                    <div className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                      {/* Gradient Glow */}
                                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-blue-500/10 blur-[40px] pointer-events-none" />

                                      {/* Header */}
                                      <div className="relative z-10 px-4 py-3 border-b border-white/5 flex items-center gap-2">
                                        <Droplets className="w-5 h-5 text-blue-400" />
                                        <span className="text-sm font-semibold text-white">Liquid Staking</span>
                                      </div>

                                      {/* Content */}
                                      <div className="relative z-10 p-4 space-y-3">
                                        {/* Stake Input */}
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">You Stake</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xl font-medium text-white">
                                              {String(message.metadata?.amount || '0')}
                                            </span>
                                            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-2.5 py-1">
                                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold">
                                                {String(message.metadata?.token || 'ETH')?.[0]}
                                              </div>
                                              <span className="text-sm font-medium text-white">
                                                {String(message.metadata?.token || 'ETH')}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex justify-center -my-1">
                                          <div className="bg-[#0A0A0A] border border-white/10 p-1.5 rounded-lg">
                                            <ArrowDown className="w-4 h-4 text-blue-400" />
                                          </div>
                                        </div>

                                        {/* Receive Output */}
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">You Receive</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xl font-medium text-white">
                                              ~{(Number(message.metadata?.amount || 0) * 0.998).toFixed(4)}
                                            </span>
                                            <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-2.5 py-1">
                                              <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-[9px] text-white font-bold">
                                                st
                                              </div>
                                              <span className="text-sm font-medium text-white">
                                                st{String(message.metadata?.token || 'ETH')}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                          onClick={() => {
                                            setCurrentStakingMetadata(message.metadata as Record<string, unknown>);
                                            setShowStakingWidget(true);
                                          }}
                                          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm transition-all hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                        >
                                          Review Staking
                                        </button>
                                      </div>

                                      {/* Footer */}
                                      <div className="relative z-10 px-4 py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                          <Droplets className="w-3 h-3 text-blue-400" />
                                        </div>
                                        <span className="text-[10px] text-zinc-500">Powered by Lido</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                    );
                  })}

                  {isSending && (
                    <div className="flex gap-4 max-w-[90%]">
                      <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0 mt-1 animate-pulse overflow-hidden p-1">
                        <Image src={zicoBlue} alt="Zico" width={24} height={24} className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                      </div>
                      <div className="flex items-center gap-1 pt-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Sticky Bottom Input (Chat State) */}
            <AnimatePresence>
              {hasMessages && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="p-2 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent z-20"
                >
                  <div className="max-w-3xl mx-auto relative group">
                    {/* Trending Prompts Dropdown */}
                    <AnimatePresence>
                      {showTrendingPrompts && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full left-0 right-0 mb-2 bg-[#0A0A0A] border border-white/10 rounded-xl p-2 shadow-2xl z-30"
                        >
                          <div className="text-xs text-zinc-500 px-3 py-2 uppercase tracking-wider">Trending Prompts</div>
                          <div className="space-y-1">
                            {trendingPrompts.map((prompt, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setInputMessage(prompt.text);
                                  setShowTrendingPrompts(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors group"
                              >
                                <span className="text-zinc-500 group-hover:text-cyan-400 transition-colors">{prompt.icon}</span>
                                <span>{prompt.text}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 flex items-center gap-4 shadow-2xl group-focus-within:ring-1 group-focus-within:ring-cyan-500/30">
                      <button
                        onClick={() => setShowTrendingPrompts(!showTrendingPrompts)}
                        className="pl-2 text-zinc-400 hover:text-cyan-400 transition-colors"
                        title="Trending prompts"
                      >
                        <Sparkles className="w-5 h-5" />
                      </button>
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => setShowTrendingPrompts(false)}
                        placeholder="Send a message..."
                        disabled={isSending || !activeConversationId || initializing}
                        className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-zinc-600 h-12"
                        autoFocus
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                        className="p-2.5 bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Send message"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="text-center mt-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">AI-Native Web3 Interface</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SeniorAppShell>

      {/* Lending Modal */}
      <AnimatePresence>
        {lendingModalOpen && (
          <Lending
            onClose={() => {
              setLendingModalOpen(false);
              setCurrentLendingMetadata(null);
            }}
            initialAmount={currentLendingMetadata?.amount as string | undefined}
            initialAsset={currentLendingMetadata?.asset as string | undefined || currentLendingMetadata?.token as string | undefined}
            initialAction={currentLendingMetadata?.action as 'supply' | 'borrow' | undefined}
          />
        )}
      </AnimatePresence>

      {/* SwapWidget Modal */}
      <AnimatePresence>
        {showSwapWidget && swapWidgetTokens && (
          <SwapWidget
            onClose={() => {
              setShowSwapWidget(false);
              setSwapWidgetTokens(null);
            }}
            initialFromToken={swapWidgetTokens.from}
            initialToToken={swapWidgetTokens.to}
            initialAmount={swapWidgetTokens.amount}
          />
        )}
      </AnimatePresence>

      {/* Staking Modal */}
      <AnimatePresence>
        {showStakingWidget && (
          <Staking
            onClose={() => {
              setShowStakingWidget(false);
              setCurrentStakingMetadata(null);
            }}
            initialAmount={currentStakingMetadata?.amount as string | undefined}
            initialToken={currentStakingMetadata?.token as string | undefined}
          />
        )}
      </AnimatePresence>
      </TransactionSettingsProvider>
    </ProtectedRoute>
  );
}

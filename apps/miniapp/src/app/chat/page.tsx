'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Container, AppLayoutWithSidebar, DesktopLayoutWithSidebar } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { SignatureApprovalButton } from '@/shared/ui';
import { PullToRefresh, useNavigationGestures, useSmoothScrollContainer } from '@/components/gestures';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import XIcon from '../../../public/icons/X.svg';
import BlockchainTechnology from '../../../public/icons/BlockchainTechnology.svg';
import Briefcase from '../../../public/icons/Briefcase.svg';
import ComboChart from '../../../public/icons/ComboChart.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import WalletIcon from '../../../public/icons/Wallet.svg';

// Declaração de tipo para window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
import { AgentsClient } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, explorerTxUrl } from '@/features/swap/utils';
import { networks, Token } from '@/features/swap/tokens';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx, QuoteResponse } from '@/features/swap/types';


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

const TRENDING_PROMPTS = [
  "What's the best DeFi strategy for yield farming?",
  "How do I bridge tokens between chains safely?",
  "Explain liquidity pools and impermanent loss",
  "Show me the latest market trends",
  "Help me analyze my portfolio",
];

const FEATURE_CARDS = [
  { name: 'Wallet Tracking', icon: WalletIcon, path: null, description: 'Track wallet performance' },
  { name: 'AI Agents on X', icon: XIcon, path: null, description: 'Social sentiment analysis' },
  { name: 'Liquid Swap', icon: SwapIcon, path: '/swap', description: 'Instant token swaps' },
  { name: 'Pano View', icon: BlockchainTechnology, path: null, description: 'Blockchain analytics' },
  { name: 'AI MarketPulse', icon: ComboChart, path: null, description: 'Real-time market data' },
  { name: 'Portfolio', icon: Briefcase, path: null, description: 'Portfolio management' },
];

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
  const [isLargeScreen, setIsLargeScreen] = useState(false);
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);

  // Gesture and scroll enhancements
  const { scrollToBottom } = useSmoothScrollContainer(messagesContainerRef);

  // Navigation gestures for mobile sidebar
  const { ref: navigationRef } = useNavigationGestures(
    () => !isLargeScreen && setSidebarOpen(true), // Swipe right to open sidebar
    undefined, // No swipe left action for now
    100
  );

  // Thirdweb setup
  const account = useActiveAccount();
  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  // Swap states
  const [swapQuote, setSwapQuote] = useState<QuoteResponse | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [executingSwap, setExecutingSwap] = useState(false);
  const [swapTxHashes, setSwapTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
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

  // Function to force MetaMask window to open
  const forceMetaMaskWindow = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      console.warn('MetaMask not available');
      return false;
    }

    try {
      console.log('🦊 Forcing MetaMask window to open...');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('✅ MetaMask window opened successfully');
      return true;
    } catch (error) {
      console.log('⚠️ MetaMask window request failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    debug('component:mount');

    return () => {
      isMountedRef.current = false;
      debug('component:unmount');
    };
  }, [debug]);

  // Detect screen size and keep sidebar open on larger screens
  useEffect(() => {
    const checkScreenSize = () => {
      const isLarge = window.innerWidth >= 1024; // lg breakpoint
      setIsLargeScreen(isLarge);
      if (isLarge) {
        setSidebarOpen(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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

  const scrollToBottomSmooth = useCallback(() => {
    if (messagesContainerRef.current) {
      scrollToBottom();
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToBottom]);

  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(scrollToBottomSmooth, 100);
    return () => clearTimeout(timer);
  }, [activeMessages, activeConversationId, scrollToBottomSmooth]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (!activeConversationId || loadingConversationId === activeConversationId) return;

    // Reload the current conversation
    await loadConversationMessages(activeConversationId);
  }, [activeConversationId, loadingConversationId, loadConversationMessages]);

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
      
      console.log('response: ', response);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || 'I was unable to process that request.',
        timestamp: new Date(),
        agentName: response.agent_name ?? null,
        metadata: response.metadata ?? undefined,
      };

      // Auto-fetch quote if it's a swap intent
      if (response.metadata?.event === 'swap_intent_ready') {
        console.log('🔄 Swap intent detected, fetching quote...', response.metadata);
        getSwapQuote(response.metadata as Record<string, unknown>);
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
    // Only close sidebar on mobile/tablet
    if (!isLargeScreen) {
      setSidebarOpen(false);
    }
    debug('conversation:select', { conversationId });
  };

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

  // Function to execute swap - following swap page pattern
  const executeSwap = useCallback(async (metadata: Record<string, unknown>) => {
    console.log('🚀 Starting swap execution with metadata:', metadata);
    
    if (!swapQuote?.quote) {
      const errorMsg = 'Aguarde a cotação ser calculada';
      console.error('❌', errorMsg);
      setSwapError(errorMsg);
      return;
    }

    const addressFromToken = getWalletAddress();
    const userAddress = localStorage.getItem('userAddress');
    const effectiveAddress = account?.address || addressFromToken || userAddress;

    if (!effectiveAddress) {
      const errorMsg = 'Authentication required. Please ensure you are logged in.';
      console.error('❌', errorMsg);
      setSwapError(errorMsg);
      return;
    }

    if (!clientId || !client) {
      const errorMsg = 'Missing THIRDWEB client configuration.';
      console.error('❌', errorMsg);
      setSwapError(errorMsg);
      return;
    }

    setSwapError(null);
    setSwapSuccess(false);

    try {
      setExecutingSwap(true);
      console.log('🔄 Preparing swap transaction...');

      const { amount, from_network, from_token, to_network, to_token } = metadata;
      
      // Get networks by name
      const fromNetwork = getNetworkByName(from_network as string);
      const toNetwork = getNetworkByName(to_network as string);

      if (!fromNetwork || !toNetwork) {
        throw new Error(`Unsupported network: ${from_network} or ${to_network}`);
      }

      // Get tokens by symbol
      const fromToken = getTokenBySymbol(from_token as string, fromNetwork.chainId);
      const toToken = getTokenBySymbol(to_token as string, toNetwork.chainId);

      if (!fromToken || !toToken) {
        throw new Error(`Token not found: ${from_token} or ${to_token}`);
      }

      console.log('📊 Token details:', { fromToken, toToken, fromNetwork, toNetwork });

      const decimals = await getTokenDecimals({
        client,
        chainId: fromNetwork.chainId,
        token: fromToken.address
      });

      const wei = parseAmountToWei(String(amount), decimals);
      if (wei <= 0n) throw new Error('Invalid amount');

      console.log('💰 Amount details:', { amount, decimals, wei: wei.toString() });

      const prep = await swapApi.prepare({
        fromChainId: fromNetwork.chainId,
        toChainId: toNetwork.chainId,
        fromToken: normalizeToApi(fromToken.address),
        toToken: normalizeToApi(toToken.address),
        amount: wei.toString(),
        sender: effectiveAddress,
      });

      const seq = flattenPrepared(prep.prepared);
      
      if (!seq.length) throw new Error('No transactions returned by prepare');

      setSwapTxHashes([]); // Reset transaction hashes

      for (const t of seq) {
        if (t.chainId !== fromNetwork.chainId) {
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
        }

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value ? BigInt(t.value as any) : 0n,
        });

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        console.log('📤 Sending transaction...', { to: t.to, chainId: t.chainId });

        // Force MetaMask window to open
        await forceMetaMaskWindow();

        const result = await safeExecuteTransactionV2(async () => {
          return await sendTransaction({ account, transaction: tx });
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.error}`);
        }

        if (!result.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned.');
        }

        // Store transaction hash
        setSwapTxHashes(prev => [...prev, { hash: result.transactionHash!, chainId: t.chainId }]);
      }

      setSwapSuccess(true);
      setSwapQuote(null);
    } catch (error) {
      console.error('❌ Error executing swap:', error);
      setSwapError(error instanceof Error ? error.message : 'Failed to execute swap');
    } finally {
      setExecutingSwap(false);
    }
  }, [swapQuote, client, account, clientId, getWalletAddress]);

  // Render sidebar content
  const renderSidebar = useCallback(() => (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="flex-shrink-0 p-4 border-b border-pano-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src={zicoBlue} alt="Zico" width={28} height={28} />
          <span className="font-semibold text-pano-text-primary">Zico AI</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-2 text-pano-text-secondary hover:text-pano-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Navigation */}
        <nav className="space-y-2">
          <Button
            variant="default"
            size="md"
            className="w-full justify-start gap-3 bg-pano-primary/10 text-pano-primary border-pano-primary/20"
            onClick={() => {
              router.push('/chat');
              if (!isLargeScreen) setSidebarOpen(false);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="w-full justify-start gap-3"
            onClick={() => {
              router.push('/swap');
              if (!isLargeScreen) setSidebarOpen(false);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Swap
          </Button>
        </nav>

        {/* New Chat Button */}
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={createNewChat}
          disabled={isCreatingConversation}
        >
          {isCreatingConversation ? (
            <>
              <div className="w-4 h-4 border-2 border-pano-primary border-t-transparent rounded-full animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </>
          )}
        </Button>

        {/* Recent Conversations */}
        {conversations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-pano-text-secondary px-2">Recent Conversations</h3>
            <div className="space-y-1">
              {conversations.slice(0, 5).map((conv) => (
                <Button
                  key={conv.id}
                  variant={conv.id === activeConversationId ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-3 text-left h-auto py-2 px-3",
                    conv.id === activeConversationId && "bg-pano-primary/10 text-pano-primary border-pano-primary/20"
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs truncate">{conv.title}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Trending Prompts */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pano-primary">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-medium text-pano-text-primary">Trending Prompts</h3>
          </div>
          <div className="space-y-1">
            {TRENDING_PROMPTS.slice(0, 3).map((prompt, idx) => (
              <Button
                key={idx}
                variant="ghost"
                size="sm"
                className="w-full text-left justify-start h-auto py-2 px-3 text-xs text-pano-text-secondary hover:text-pano-text-primary"
                onClick={() => sendMessage(prompt)}
                disabled={!activeConversationId || isSending}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="flex-shrink-0 p-4 border-t border-pano-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-pano-error border-pano-error/20 hover:bg-pano-error/10 hover:border-pano-error/50"
          onClick={async () => {
            try {
              localStorage.removeItem('authToken');
              localStorage.removeItem('authPayload');
              localStorage.removeItem('authSignature');
              localStorage.removeItem('telegram_user');
              if (!isLargeScreen) setSidebarOpen(false);
              await new Promise(resolve => setTimeout(resolve, 100));
              window.location.href = '/miniapp';
            } catch (error) {
              console.error('Error disconnecting:', error);
              window.location.href = '/miniapp';
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Disconnect
        </Button>
      </div>
    </div>
  ), [conversations, activeConversationId, isCreatingConversation, isSending, router, isLargeScreen]);

  // Signature approval handlers
  const handleSignatureApproval = useCallback(async (metadata: Record<string, unknown>) => {
    console.log('✅ Signature approved');

    // Force MetaMask window to open before executing swap
    await forceMetaMaskWindow();

    await executeSwap(metadata);
  }, [executeSwap, forceMetaMaskWindow]);

  const handleSignatureRejection = useCallback(async () => {
    console.log('❌ Signature rejected');
  }, []);

  // Render messages content
  const renderMessages = useCallback(() => {
    if (initializing) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            {initializationError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-pano-error/10 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pano-error">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-pano-text-secondary">{initializationError}</p>
                <Button onClick={retryBootstrap} size="sm">
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-pano-primary/10 flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 border-2 border-pano-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-pano-text-secondary">Loading your conversations...</p>
              </>
            )}
          </div>
        </div>
      );
    }

    if (!activeConversationId) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 rounded-full bg-pano-primary/10 flex items-center justify-center mx-auto">
              <Image src={zicoBlue} alt="Zico" width={32} height={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-pano-text-primary">Welcome to Zico AI</h2>
              <p className="text-pano-text-secondary">Your DeFi assistant is ready to help</p>
            </div>
            <Button onClick={createNewChat} disabled={isCreatingConversation}>
              {isCreatingConversation ? 'Creating...' : 'Start New Chat'}
            </Button>
          </div>
        </div>
      );
    }

    if (initializationError && activeMessages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-pano-error/10 flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pano-error">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-pano-text-secondary">{initializationError}</p>
            <Button onClick={retryBootstrap} size="sm">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (isHistoryLoading && activeMessages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-pano-primary/10 flex items-center justify-center mx-auto">
              <div className="w-6 h-6 border-2 border-pano-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-pano-text-secondary">Loading conversation...</p>
          </div>
        </div>
      );
    }

    if (activeMessages.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-2xl">
            <div className="w-16 h-16 rounded-full bg-pano-primary/10 flex items-center justify-center mx-auto">
              <Image src={zicoBlue} alt="Zico" width={32} height={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-pano-text-primary">Get Started with DeFi</h2>
              <p className="text-pano-text-secondary">Choose a feature below or start chatting</p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
              {FEATURE_CARDS.map((feature, idx) => (
                <Card
                  key={idx}
                  variant={feature.path ? "interactive" : "default"}
                  size="sm"
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    !feature.path && "opacity-50 cursor-not-allowed hover:scale-100"
                  )}
                  onClick={() => {
                    if (feature.path) {
                      router.push(feature.path);
                    }
                  }}
                >
                  <CardContent className="flex flex-col items-center text-center space-y-2 p-4">
                    <Image
                      src={feature.icon}
                      alt={feature.name}
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-pano-text-primary">{feature.name}</h3>
                      <p className="text-xs text-pano-text-muted">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Trending Prompts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-pano-text-secondary">Try these prompts:</h3>
              <div className="grid gap-2">
                {TRENDING_PROMPTS.slice(0, 3).map((prompt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-left justify-start h-auto py-2 px-3 text-sm"
                    onClick={() => sendMessage(prompt)}
                    disabled={isSending}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Render active conversation messages
    return (
      <div className="flex-1 overflow-y-auto">
        <Container className="py-4 space-y-4 max-w-4xl">
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
                className={cn(
                  "flex gap-3 animate-fade-in",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {message.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-pano-primary flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pano-surface-elevated flex items-center justify-center">
                      <Image src={zicoBlue} alt="Zico" width={20} height={20} />
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={cn(
                  "flex-1 max-w-[75%] space-y-1",
                  message.role === 'user' ? "items-end" : "items-start"
                )}>
                  {/* Message Header */}
                  <div className={cn(
                    "flex items-center gap-2 text-xs text-pano-text-muted",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    <span className="font-medium">
                      {message.role === 'user' ? 'You' : (message.agentName || 'Zico')}
                    </span>
                    {timeLabel && <span>{timeLabel}</span>}
                  </div>

                  {/* Message Bubble */}
                  <Card
                    variant={message.role === 'user' ? "filled" : "default"}
                    size="sm"
                    className={cn(
                      "inline-block max-w-full",
                      message.role === 'user'
                        ? "bg-pano-primary text-white"
                        : "bg-pano-surface-elevated"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="text-sm leading-relaxed break-words">
                        {message.content}

                        {/* Swap Interface for assistant messages */}
                        {message.role === 'assistant' &&
                          message.metadata?.event === 'swap_intent_ready' && (
                          <div className="mt-4 space-y-3">
                            {/* Quote Loading */}
                            {swapLoading && (
                              <div className="flex items-center gap-2 text-pano-primary">
                                <div className="w-4 h-4 border-2 border-pano-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">Getting quote...</span>
                              </div>
                            )}

                            {/* Quote Display */}
                            {swapQuote?.quote && (
                              <Card variant="filled" size="xs">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-pano-text-secondary">You will receive:</span>
                                    <span className="text-sm font-medium text-pano-text-primary">
                                      {formatAmountHuman(BigInt(swapQuote.quote.estimatedReceiveAmount), 18)} {String(message.metadata?.to_token)}
                                    </span>
                                  </div>
                                  {swapQuote.quote.fees?.totalFeeUsd && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-pano-text-secondary">Total fees:</span>
                                      <span className="text-sm text-pano-text-muted">${swapQuote.quote.fees.totalFeeUsd}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {/* Error Display */}
                            {swapError && (
                              <Card variant="filled" className="border-pano-error/20 bg-pano-error/10">
                                <CardContent className="p-3">
                                  <p className="text-sm text-pano-error">{swapError}</p>
                                </CardContent>
                              </Card>
                            )}

                            {/* Success Display */}
                            {swapSuccess && (
                              <Card variant="filled" className="border-pano-success/20 bg-pano-success/10">
                                <CardContent className="p-3 space-y-3">
                                  <p className="text-sm text-pano-success font-medium">✅ Swap executed successfully!</p>

                                  {swapTxHashes.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-xs text-pano-text-muted">Transaction Hashes:</div>
                                      {swapTxHashes.map((tx, index) => {
                                        const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
                                        return (
                                          <div key={index} className="flex items-center justify-between bg-pano-surface rounded p-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs text-pano-text-primary font-mono truncate">
                                                {tx.hash}
                                              </div>
                                              <div className="text-xs text-pano-text-muted">
                                                Chain ID: {tx.chainId}
                                              </div>
                                            </div>
                                            {explorerUrl && (
                                              <Button
                                                size="xs"
                                                variant="outline"
                                                asChild
                                              >
                                                <a
                                                  href={explorerUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="ml-2"
                                                >
                                                  View
                                                </a>
                                              </Button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {/* Signature Approval Button */}
                            {swapQuote?.quote && (
                              <SignatureApprovalButton
                                onApprove={() => handleSignatureApproval(message.metadata as Record<string, unknown>)}
                                onReject={handleSignatureRejection}
                                disabled={isSending || swapLoading || executingSwap}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-pano-surface-elevated flex items-center justify-center">
                <Image src={zicoBlue} alt="Zico" width={20} height={20} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-pano-text-muted">
                  <span className="font-medium">Zico</span>
                </div>
                <Card variant="default" size="sm" className="inline-block">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-pano-primary rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-pano-primary rounded-full animate-pulse delay-75" />
                      <div className="w-2 h-2 bg-pano-primary rounded-full animate-pulse delay-150" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </Container>
      </div>
    );
  }, [
    initializing,
    initializationError,
    activeConversationId,
    activeMessages,
    isHistoryLoading,
    isCreatingConversation,
    isSending,
    swapLoading,
    swapQuote,
    swapError,
    swapSuccess,
    swapTxHashes,
    retryBootstrap,
    createNewChat,
    sendMessage,
    router,
    handleSignatureApproval,
    handleSignatureRejection,
    executingSwap
  ]);


  // Helper function to flatten prepared transactions (from swap page)
  function flattenPrepared(prepared: any): PreparedTx[] {
    const out: PreparedTx[] = [];
    if (prepared?.transactions) {
      out.push(...prepared.transactions);
    }
    if (prepared?.steps) {
      for (const step of prepared.steps) {
        if (step.transactions) {
          out.push(...step.transactions);
        }
      }
    }
    return out;
  }

  return (
    <AppLayout>
      {/* Mobile Layout */}
      <MobileLayout className="lg:hidden">
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-pano-border bg-pano-surface flex items-center justify-between safe-top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-pano-text-secondary hover:text-pano-text-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>

            <div className="flex items-center gap-2">
              <Image src={zicoBlue} alt="Zico" width={24} height={24} />
              <span className="text-lg font-semibold text-pano-text-primary">Chat</span>
            </div>

            <div className="w-8"></div>
          </div>

          {/* Mobile Messages with Gestures */}
          <div
            ref={navigationRef}
            className="flex-1 relative"
          >
            <PullToRefresh
              onRefresh={handleRefresh}
              className="h-full"
              disabled={!activeConversationId || initializing}
            >
              <div
                ref={messagesContainerRef}
                className="h-full overflow-y-auto"
              >
                {renderMessages()}
              </div>
            </PullToRefresh>
          </div>

          {/* Mobile Input */}
          <div className="flex-shrink-0 p-4 border-t border-pano-border bg-pano-surface safe-bottom">
            <div className="flex items-center gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isSending || !activeConversationId || initializing}
                className="flex-1 rounded-2xl"
                size="lg"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim() || isSending || !activeConversationId || initializing}
                size="lg"
                className="rounded-2xl px-4"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-80 bg-pano-surface border-r border-pano-border z-50 overflow-y-auto safe-top safe-bottom">
              {renderSidebar()}
            </div>
          </>
        )}
      </MobileLayout>

      {/* Desktop Layout */}
      <DesktopLayout className="hidden lg:flex">
        <div className="flex h-full">
          {/* Desktop Sidebar */}
          <div className="w-80 border-r border-pano-border bg-pano-surface overflow-y-auto">
            {renderSidebar()}
          </div>

          {/* Desktop Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Desktop Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-pano-border bg-pano-surface flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image src={zicoBlue} alt="Zico" width={32} height={32} />
                <h1 className="text-xl font-semibold text-pano-text-primary">Chat Assistant</h1>
              </div>

              {activeConversationId && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={createNewChat} disabled={isCreatingConversation}>
                    {isCreatingConversation ? 'Creating...' : 'New Chat'}
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop Messages */}
            <div className="flex-1 overflow-y-auto">
              {renderMessages()}
            </div>

            {/* Desktop Input */}
            <div className="flex-shrink-0 p-6 border-t border-pano-border bg-pano-surface">
              <div className="flex items-end gap-3 max-w-4xl mx-auto">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isSending || !activeConversationId || initializing}
                  className="flex-1 min-h-[44px] py-3 rounded-2xl resize-none"
                  size="lg"
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || isSending || !activeConversationId || initializing}
                  size="lg"
                  className="rounded-2xl px-6 h-[44px]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DesktopLayout>
    </AppLayout>

  );
}

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Window.ethereum type declaration
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
import { Sidebar, SignatureApprovalButton, GlobalLoader } from '@/shared/ui';
import MarkdownMessage from '@/shared/ui/MarkdownMessage';
import Image from 'next/image';
import '../../shared/ui/loader.css';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import XIcon from '../../../public/icons/X.svg';
import BlockchainTechnology from '../../../public/icons/BlockchainTechnology.svg';
import Briefcase from '../../../public/icons/Briefcase.svg';
import ComboChart from '../../../public/icons/ComboChart.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import WalletIcon from '../../../public/icons/Wallet.svg';
import ChatIcon from '../../../public/icons/chat.svg';
import LightningIcon from '../../../public/icons/lightning.svg';
import UniswapIcon from '../../../public/icons/uniswap.svg';
import { AgentsClient } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { SwapSuccessCard } from '@/components/ui/SwapSuccessCard';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, explorerTxUrl } from '@/features/swap/utils';
import { networks, Token } from '@/features/swap/tokens';
import { useActiveAccount, useActiveWallet, useDisconnect, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx, QuoteResponse } from '@/features/swap/types';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';


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
];

const FEATURE_CARDS = [
  { name: 'Portfolio View', icon: Briefcase, path: null, prompt: null, description: 'Track and manage your entire DeFi portfolio in one place' },
  { name: 'Liquidity Pools', icon: ComboChart, path: null, prompt: null, description: 'Liquidity Provision Management: Manage pool entries and exits through simple prompts optimizing routes, ranges and capital across chains' },
  { name: 'Liquid Staking', icon: BlockchainTechnology, path: null, prompt: null, description: 'Liquid Staking: Stake assets through direct commands with automated reward tracking and compounding cycles across various protocols.' },
  { name: 'Lending', icon: WalletIcon, path: null, prompt: null, description: 'Lending & Borrowing: Access positions across protocols through easy commands managing collateral, comparing rates and adjusting exposure.' },
  { name: 'Custom Orders', icon: LightningIcon, path: null, prompt: null, description: 'DCA & Trigger Orders: Configure multi-token DCA plans and threshold-based execution rules directly in chat.' },
  { name: 'Liquid Swap', icon: SwapIcon, path: null, prompt: 'I would like to perform a token swap. Can you help me with the process and guide me through the steps?', description: 'Swap tokens across multiple chains with the best rates' },
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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [bootstrapVersion, setBootstrapVersion] = useState(0);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);

  // Thirdweb setup
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const switchChain = useSwitchActiveWalletChain();
  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  // Swap states
  const [swapQuote, setSwapQuote] = useState<QuoteResponse | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [executingSwap, setExecutingSwap] = useState(false);
  const [swapTxHashes, setSwapTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [swapStatusMessage, setSwapStatusMessage] = useState<string | null>(null);

  // Swap flow states
  const [swapFlowStep, setSwapFlowStep] = useState<'preview' | 'routing' | 'details' | 'confirm' | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [currentSwapMetadata, setCurrentSwapMetadata] = useState<Record<string, unknown> | null>(null);
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

  const handleWalletDisconnect = useCallback(async () => {
    try {
      if (activeWallet) {
        await disconnect(activeWallet);
      }
    } catch (error) {
      console.error('[CHAT] Failed to disconnect wallet:', error);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authPayload');
        localStorage.removeItem('authSignature');
        localStorage.removeItem('telegram_user');
        localStorage.removeItem('userAddress');
        setSidebarOpen(false);
        window.location.href = '/miniapp';
      }
    }
  }, [activeWallet, disconnect]);

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

  // Reset navigation loader when leaving the chat page
  useEffect(() => {
    if (pathname !== '/chat') {
      setIsNavigating(false);
    }
  }, [pathname]);

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
        setCurrentSwapMetadata(metadata);
        setSwapFlowStep('routing');
        console.log('✅ Quote received successfully - Opening Order Routing modal');
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
      const errorMsg = 'Please wait for the quote to finish calculating';
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
      setSwapStatusMessage('Preparing swap transaction...');
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

      // Switch to the correct chain FIRST, before executing transactions
      if (account && switchChain) {
        const networkName = fromNetwork.name || `Chain ${fromNetwork.chainId}`;
        console.log('🔄 Switching to source chain before executing swap...');
        console.log('Target chain:', fromNetwork.chainId, networkName);

        setSwapStatusMessage(`Switching to ${networkName}...`);

        try {
          await switchChain(defineChain(fromNetwork.chainId));
          console.log('✅ Chain switched successfully to:', fromNetwork.chainId);
        } catch (e: any) {
          console.error('❌ Failed to switch chain:', e);
          throw new Error(`Please approve the network switch to ${networkName} in your wallet.`);
        }
      }

      setSwapTxHashes([]); // Reset transaction hashes
      setSwapStatusMessage('Please confirm the transaction in your wallet...');

      for (const t of seq) {
        if (t.chainId !== fromNetwork.chainId) {
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
        }

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value != null ? BigInt(t.value as any) : 0n,
          gas: t.gasLimit != null ? BigInt(t.gasLimit as any) : undefined,
          maxFeePerGas: t.maxFeePerGas != null ? BigInt(t.maxFeePerGas as any) : undefined,
          maxPriorityFeePerGas:
            t.maxPriorityFeePerGas != null ? BigInt(t.maxPriorityFeePerGas as any) : undefined,
        });

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        console.log('📤 Sending transaction...', { to: t.to, chainId: t.chainId });

        // Force MetaMask window to open
        await forceMetaMaskWindow();
        setSwapStatusMessage('Waiting for wallet confirmation...');

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
        setSwapStatusMessage('Transaction submitted. Waiting for confirmation...');
      }

      setSwapSuccess(true);
      setSwapQuote(null);
      setSwapStatusMessage(null);
    } catch (error) {
      console.error('❌ Error executing swap:', error);
      setSwapError(error instanceof Error ? error.message : 'Failed to execute swap');
      setSwapStatusMessage(null);
    } finally {
      setExecutingSwap(false);
      setSwapStatusMessage(null);
    }
  }, [swapQuote, client, account, clientId, getWalletAddress]);

  const handleSignatureApproval = useCallback(async (metadata: Record<string, unknown>) => {
    console.log('✅ Signature approved');
    
    // Force MetaMask window to open before executing swap
    await forceMetaMaskWindow();
    
    await executeSwap(metadata);
  }, [executeSwap, forceMetaMaskWindow]);

  const handleSignatureRejection = useCallback(async () => {
    console.log('❌ Signature rejected');
  }, []);

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
    <ProtectedRoute>
      <GlobalLoader isLoading={initializing && !initializationError} message="Setting up your workspace..." />
      <GlobalLoader isLoading={isNavigating} message="Loading Swap..." />
      <div className="h-screen pano-gradient-bg text-white flex flex-col overflow-hidden">
      {/* Top Navbar - Horizontal across full width */}
      <header className="sticky top-0 flex-shrink-0 bg-black border-b-2 border-white/15 px-6 py-3 z-50">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Left: Menu toggle (mobile only) + Logo (desktop only) + Navigation */}
          <div className="flex items-center gap-8">
            {!isLargeScreen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-white"
                aria-label="Open menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Logo - Desktop on left, Mobile just icon */}
            {!isLargeScreen ? (
              <div className="flex items-center gap-2">
                <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
                <span className="text-white font-semibold text-sm tracking-wide">PANORAMA BLOCK</span>
              </div>
            )}
          </div>

          {/* Right: Explore + Docs + Notifications + Wallet Address */}
          <div className="flex items-center gap-3">
            {/* Navigation Menu - Desktop only */}
            {isLargeScreen && (
              <nav className="flex items-center gap-6 text-sm mr-3">
                {/* Explore Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    Explore
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {exploreDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setExploreDropdownOpen(false)}
                      />
                      <div className="absolute top-full right-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-20">
                        <div className="py-2">
                          <button
                            onClick={() => {
                              setExploreDropdownOpen(false);
                              router.push('/chat');
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4BC3C5" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Chat
                          </button>
                          <button
                            onClick={() => {
                              setIsNavigating(true);
                              setExploreDropdownOpen(false);
                              router.push('/swap');
                            }}
                            className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                          >
                            <Image src={SwapIcon} alt="Swap" width={16} height={16} />
                            Swap
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Docs Link */}
                <a
                  href="https://docs.panoramablock.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Docs
                </a>
              </nav>
            )}
            {/* Notifications Icon */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Wallet Address Display */}
            {(account?.address || getWalletAddress()) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                <div className="w-2 h-2 rounded-full bg-[#00FFC3]"></div>
                <span className="text-white text-xs font-mono">
                  {account?.address
                    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                    : getWalletAddress()
                      ? `${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`
                      : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content area with sidebar and messages */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Below navbar */}
        {(isLargeScreen || sidebarOpen) && (
          <>
            {/* Mobile backdrop */}
            {!isLargeScreen && sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar content */}
            <aside className={`
              ${isLargeScreen ? 'relative' : 'fixed inset-y-0 left-0 z-50'}
              w-80 bg-black border-r-2 border-white/15 flex flex-col
              ${!isLargeScreen && !sidebarOpen ? 'hidden' : ''}
            `}>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* New Chat Button */}
                <div className="px-4">
                  <button
                    onClick={createNewChat}
                    disabled={isCreatingConversation}
                    className="w-full px-4 py-2 rounded-full border border-white bg-transparent hover:bg-gray-900 text-white text-sm font-normal transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingConversation ? (
                      <>
                        <div className="loader-inline-sm" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <span>New Chat</span>
                    )}
                  </button>
                </div>

                {/* Past Conversations */}
                {conversations.length > 0 && (
                  <div className="max-h-[180px] overflow-y-auto custom-scrollbar pr-2 px-4">
                    <div className="space-y-3">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => handleSelectConversation(conversation.id)}
                          className={`w-full text-left px-3 py-2 transition-colors text-sm flex items-center gap-3 rounded-md ${
                            activeConversationId === conversation.id
                              ? 'text-white bg-[#202020]'
                              : 'text-gray-400 hover:text-white hover:bg-[#202020]'
                          }`}
                        >
                          <Image src={ChatIcon} alt="Chat" width={20} height={20} className="shrink-0" />
                          <div className="truncate">{conversation.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Separator Line */}
                <div className="border-t border-white/20 my-6"></div>

                {/* Trending Prompts */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Image src={LightningIcon} alt="Lightning" width={18} height={18} />
                    <h3 className="text-sm font-semibold text-white">
                      Trending Prompts
                    </h3>
                  </div>
                  <div className="space-y-3 px-4">
                    {TRENDING_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(prompt)}
                        disabled={isSending || !activeConversationId}
                        className="w-full text-left text-sm text-gray-400 leading-relaxed hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#202020] px-4 py-4 rounded-md"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/15">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleWalletDisconnect}
                  className="w-full justify-center text-gray-300 hover:text-white hover:bg-white/5 border border-white/10 text-sm font-normal"
                >
                  Disconnect
                </Button>
              </div>
            </aside>
          </>
        )}

        {/* Messages Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Messages or Empty State */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {initializing ? (
              <div className="h-full flex items-center justify-center px-4 py-12 text-center">
                {initializationError ? (
                  <div className="space-y-4">
                    <p className="text-gray-300">{initializationError}</p>
                    <button
                      onClick={retryBootstrap}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all font-medium"
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
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all font-medium"
                >
                  Try again
                </button>
              </div>
            ) : isHistoryLoading && activeMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center px-4 py-12">
                <p className="text-gray-400">Loading conversation...</p>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 sm:px-8 md:px-12 lg:px-16 py-1 sm:py-2 md:py-3 lg:py-4">
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-normal text-white mb-2 sm:mb-3 md:mb-4 lg:mb-5 xl:mb-6 flex-shrink-0">
                  How can I help you today?
                </h2>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-4 2xl:gap-5 w-full max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
                  {FEATURE_CARDS.map((feature, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (feature.path) {
                          router.push(feature.path);
                        } else if (feature.prompt) {
                          sendMessage(feature.prompt);
                        }
                      }}
                      disabled={!feature.path && !feature.prompt}
                      className={`flex flex-col p-3 sm:p-2 md:p-2.5 lg:p-3 xl:p-4 2xl:p-5 rounded-lg md:rounded-xl bg-black/80 backdrop-blur-md border border-white/15 transition-all shadow-lg text-left ${
                        !feature.path && !feature.prompt ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/30 cursor-pointer'
                      }`}
                    >
                      {/* Icon */}
                      <div className="mb-1.5 sm:mb-1 md:mb-1.5 lg:mb-2 xl:mb-2.5">
                        <Image
                          src={feature.icon}
                          alt={feature.name}
                          width={48}
                          height={48}
                          className="w-7 h-7 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 2xl:w-12 2xl:h-12"
                        />
                      </div>

                      {/* Title */}
                      <h3 className="text-[11px] sm:text-[9px] md:text-[10px] lg:text-xs xl:text-sm 2xl:text-base text-white font-semibold mb-1 sm:mb-0.5 md:mb-1 lg:mb-1.5">
                        {feature.name}
                      </h3>

                      {/* Description */}
                      <p className="text-[9px] sm:text-[8px] md:text-[9px] lg:text-[10px] xl:text-xs 2xl:text-sm text-gray-400 leading-snug mb-2 sm:mb-1.5 md:mb-2 lg:mb-2.5 xl:mb-3 flex-1 line-clamp-3 sm:line-clamp-2">
                        {feature.description}
                      </p>

                      {/* Continue Button - Only on larger screens */}
                      <div className="hidden sm:block w-full px-1.5 py-0.5 sm:px-2 sm:py-0.5 md:px-2.5 md:py-1 lg:px-3 lg:py-1.5 xl:px-4 xl:py-2 rounded-md bg-white text-black text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs xl:text-sm 2xl:text-base font-medium text-center">
                        Continue
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6">
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
                    className="w-full"
                  >
                    <div className="max-w-3xl mx-auto px-4 py-4">
                      {message.role === 'user' ? (
                        // User message - aligned to the right with background
                        <div className="flex items-start gap-3 justify-end">
                          <div className="flex flex-col items-end max-w-[80%]">
                            <div className="flex items-center gap-2 mb-2">
                              {timeLabel ? (
                                <span className="text-xs text-gray-500">{timeLabel}</span>
                              ) : null}
                              <span className="text-sm font-semibold text-gray-300">You</span>
                            </div>
                            <div className="rounded-2xl bg-[#202020] text-gray-200 px-4 py-3 text-[15px] break-words leading-relaxed">
                              {message.content}
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                            <div className="w-full h-full rounded-full bg-gray-700 text-white flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Assistant message - aligned to the left without background
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                            <Image
                              src={zicoBlue}
                              alt="Zico"
                              width={32}
                              height={32}
                              className="w-8 h-8"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-300">Zico</span>
                              {timeLabel ? (
                                <span className="text-xs text-gray-500">{timeLabel}</span>
                              ) : null}
                            </div>
                            <div className="text-[15px] break-words leading-relaxed text-gray-200">
                              <MarkdownMessage text={message.content} />
                            </div>
                          
                            {/* Swap Interface */}
                            {message.role === 'assistant' &&
                              message.metadata?.event === 'swap_intent_ready' && (
                              <div className="mt-4">
                                {/* Loading State */}
                                {swapLoading && !swapQuote?.quote && (
                                  <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 text-gray-300">
                                      <div className="loader-inline-sm" />
                                      <span className="text-sm">Getting quote...</span>
                                    </div>
                                  </div>
                                )}

                                {swapStatusMessage && (
                                  <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mt-3">
                                    <div className="flex items-center gap-2 text-gray-300">
                                      {executingSwap && <div className="loader-inline-sm" />}
                                      <span className="text-sm">{swapStatusMessage}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Error State */}
                                {swapError && !swapLoading && (
                                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
                                    <p className="text-sm text-red-400">❌ {swapError}</p>
                                  </div>
                                )}

                                {/* Swap Preview Card - Hidden, modal flow is used instead */}
                                {false && swapQuote?.quote && !swapSuccess && (
                                  <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden max-w-sm">
                                    {/* Header */}
                                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                                      <h3 className="text-sm font-semibold text-white">Preview Swap Position</h3>
                                      <button
                                        onClick={() => {
                                          setSwapQuote(null);
                                          setSwapError(null);
                                        }}
                                        className="text-gray-400 hover:text-white transition-colors"
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Token Pair Indicator */}
                                    <div className="px-4 py-3 bg-[#2A2A2A]/50">
                                      <div className="flex items-center gap-2.5">
                                        {/* Overlapping circles */}
                                        <div className="relative flex items-center">
                                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black">
                                            {String(message.metadata?.from_token).slice(0, 1)}
                                          </div>
                                          <div className="w-7 h-7 rounded-full bg-gray-500 flex items-center justify-center text-xs font-bold text-white -ml-2">
                                            {String(message.metadata?.to_token).slice(0, 1)}
                                          </div>
                                        </div>

                                        <div className="flex-1">
                                          <div className="text-sm text-white font-medium">
                                            {String(message.metadata?.from_token)}/{String(message.metadata?.to_token)}
                                          </div>
                                          <div className="text-xs text-gray-400 mt-0.5">
                                            {String(message.metadata?.from_network)} → {String(message.metadata?.to_network)}
                                          </div>
                                        </div>

                                        {swapQuote?.quote?.fees?.totalFeeUsd && (
                                          <div className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded">
                                            ${swapQuote?.quote?.fees?.totalFeeUsd}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Content */}
                                    <div className="px-4 py-3 space-y-3">
                                      {/* Token Deposited */}
                                      <div>
                                        <div className="text-xs text-gray-400 mb-2">Token Deposited</div>
                                        <div className="text-xl font-light text-white mb-2">
                                          ${(parseFloat(String(message.metadata?.amount)) * 1800).toFixed(3)}
                                        </div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 rounded-full bg-white"></div>
                                              <span className="text-xs text-white">{String(message.metadata?.from_token)}</span>
                                            </div>
                                            <span className="text-xs text-white">{String(message.metadata?.amount)}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                                              <span className="text-xs text-white">{String(message.metadata?.to_token)}</span>
                                            </div>
                                            <span className="text-xs text-white">{formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Divider Line */}
                                      <div className="border-t border-white/5"></div>

                                      {/* Min. Amounts */}
                                      <div>
                                        <div className="text-xs text-gray-400 mb-2">Min. Amounts to Receive</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 rounded-full bg-white"></div>
                                              <span className="text-xs text-white">{String(message.metadata?.from_token)}</span>
                                            </div>
                                            <span className="text-xs text-white">0</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                                              <span className="text-xs text-white">{String(message.metadata?.to_token)}</span>
                                            </div>
                                            <span className="text-xs text-white">{(parseFloat(formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)) * 0.99).toFixed(6)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Price Range */}
                                      <div>
                                        <div className="text-xs text-gray-400 mb-2">Price Range</div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                                            <div className="text-xs text-gray-400 mb-0.5">Min</div>
                                            <div className="text-base font-medium text-white">
                                              {(parseFloat(formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)) / parseFloat(String(message.metadata?.amount)) * 0.95).toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                              {String(message.metadata?.to_token)} per {String(message.metadata?.from_token)}
                                            </div>
                                          </div>
                                          <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                                            <div className="text-xs text-gray-400 mb-0.5">Max</div>
                                            <div className="text-base font-medium text-white">
                                              {(parseFloat(formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)) / parseFloat(String(message.metadata?.amount)) * 1.05).toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                              {String(message.metadata?.to_token)} per {String(message.metadata?.from_token)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Fee Tier */}
                                      <div className="flex items-center justify-between py-1.5">
                                        <span className="text-xs text-gray-400">Fee Tier</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs text-cyan-400 font-medium">Best for Stable Pairs</span>
                                          <span className="text-xs text-white">0.01%</span>
                                        </div>
                                      </div>

                                      {/* Details */}
                                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                                        {swapQuote?.quote?.fees?.totalFeeUsd && (
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">Est. Total Gas Fee</span>
                                            <span className="text-xs text-white">${swapQuote?.quote?.fees?.totalFeeUsd}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-gray-400">Slippage Setting</span>
                                          <span className="text-xs text-white">10%</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-gray-400">Order Routing</span>
                                          <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full bg-white"></div>
                                            <span className="text-xs text-white">UNI V3</span>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400">
                                              <circle cx="12" cy="12" r="10" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                                            </svg>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Error Message */}
                                      {swapError && (
                                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                                          <p className="text-sm text-red-400">{swapError}</p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="px-4 py-3 border-t border-white/10 flex gap-2">
                                      <button
                                        onClick={() => {
                                          setSwapQuote(null);
                                          setSwapError(null);
                                        }}
                                        className="flex-1 py-2.5 rounded-xl bg-[#2A2A2A] hover:bg-[#333333] text-white text-sm font-medium transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => {
                                          setCurrentSwapMetadata(message.metadata as Record<string, unknown>);
                                          setSwapFlowStep('routing');
                                        }}
                                        disabled={executingSwap}
                                        className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-500 text-black text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Confirm Open Position
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Success State */}
                                {swapSuccess && (
                                  <SwapSuccessCard
                                    txHashes={swapTxHashes}
                                    variant="compact"
                                    onClose={() => {
                                      setSwapSuccess(false);
                                      setSwapTxHashes([]);
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="w-full">
                  <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                        <Image
                          src={zicoBlue}
                          alt="Zico"
                          width={32}
                          height={32}
                          className="w-8 h-8"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-300">Zico</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area - Fixed with black bg */}
            <div className="flex-shrink-0 bg-black px-4 pb-6 pt-6">
              <div className="flex items-center gap-3 max-w-4xl mx-auto relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isSending || !activeConversationId || initializing}
                  className="flex-1 px-4 py-3 rounded-3xl bg-[#202020] border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 disabled:opacity-50"
                />

                {/* Send Button - Round with white bg */}
                <button
                  onClick={() => sendMessage()}
                  disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                  className="p-3 rounded-full bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-black" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Order Routing Modal */}
      {swapFlowStep === 'routing' && swapQuote?.quote && currentSwapMetadata && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setSwapFlowStep(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black z-10">
                <h3 className="text-base sm:text-lg font-semibold text-white">Order Routing</h3>
                <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
                {/* Select Swap API Label */}
                <div className="text-xs sm:text-sm font-medium text-white">Select Swap API</div>

                {/* Routing Option Card */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {/* Radio Button + Label */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black"></div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-white font-semibold text-xs sm:text-sm">UNI V3</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500">
                            <circle cx="12" cy="12" r="10" strokeWidth={2} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 ml-6 sm:ml-7">Est. Price Impact 1.1%</div>
                    </div>

                    {/* Swap Info */}
                    <div className="flex-1 space-y-2 sm:space-y-3">
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="text-sm sm:text-base font-medium text-white break-words">
                          Swap {String(currentSwapMetadata?.from_token)} to {String(currentSwapMetadata?.to_token)}
                        </div>
                        <div className="px-2 py-1 bg-cyan-400/20 text-cyan-400 text-[10px] sm:text-xs font-semibold rounded flex items-center gap-1 flex-shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                          Suggested
                        </div>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Amount in</span>
                          <span className="text-white font-medium text-right break-words">
                            {String(currentSwapMetadata?.amount)} {String(currentSwapMetadata?.from_token)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">Expected Amount Out</span>
                          <span className="text-white font-medium text-right break-words">
                            {formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)} {String(currentSwapMetadata?.to_token)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400 text-[11px] sm:text-xs">Min. Out After Slippage</span>
                          <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                            {(parseFloat(formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)) * 0.99).toFixed(6)} {String(currentSwapMetadata?.to_token)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={() => setSwapFlowStep('details')}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors"
                >
                  Continue
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-start gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    <Image
                      src={UniswapIcon}
                      alt="Uniswap"
                      width={44}
                      height={44}
                      className="w-11 h-11"
                      style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                    />
                  </div>
                  <span>Powered by Uniswap</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Swap Details Modal */}
      {swapFlowStep === 'details' && swapQuote?.quote && currentSwapMetadata && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setSwapFlowStep(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black z-10">
                <h3 className="text-base sm:text-lg font-semibold text-white">Swap Details</h3>
                <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
                {/* Select Swap API */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-white">Select Swap API</span>
                  <button disabled className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#202020] text-gray-400 text-[10px] sm:text-xs font-medium cursor-not-allowed flex-shrink-0">
                    Change API
                  </button>
                </div>

                {/* Routing */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-gray-400">Routing</span>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white flex items-center justify-center">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-black"></div>
                    </div>
                    <span className="text-xs sm:text-sm text-white">UNI V3</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500">
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-2 py-1 bg-cyan-400/20 text-cyan-400 text-[10px] sm:text-xs font-semibold rounded flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                    Suggested
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400">Est. Price Impact 1.1%</span>
                </div>

                {/* Swap Details Card */}
                <div className="bg-[#0A0A0A] border border-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="text-sm sm:text-base font-semibold text-white mb-3 sm:mb-4 break-words">
                    Swap {String(currentSwapMetadata?.from_token)} to {String(currentSwapMetadata?.to_token)}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Amount in</span>
                      <span className="text-white font-medium text-right break-words">
                        {String(currentSwapMetadata?.amount)} {String(currentSwapMetadata?.from_token)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 text-[11px] sm:text-xs">Expected Amount Out</span>
                      <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                        {formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)} {String(currentSwapMetadata?.to_token)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 text-[11px] sm:text-xs">Min. Out After Slippage</span>
                      <span className="text-white font-medium text-right break-words text-[11px] sm:text-xs">
                        {(parseFloat(formatAmountHuman(BigInt(swapQuote?.quote?.estimatedReceiveAmount || 0), 18)) * 0.99).toFixed(6)} {String(currentSwapMetadata?.to_token)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aperture Fee */}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-white font-medium">Aperture Fee</span>
                  <span className="text-gray-400">0.9% (&lt;$0.01)</span>
                </div>

                {/* Transaction Settings */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-xs sm:text-sm">Transaction Setting</span>
                    <button disabled className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#202020] text-gray-400 text-[10px] sm:text-xs font-medium cursor-not-allowed flex-shrink-0">
                      Change Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={() => setSwapFlowStep('confirm')}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors"
                >
                  Continue
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-start gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    <Image
                      src={UniswapIcon}
                      alt="Uniswap"
                      width={44}
                      height={44}
                      className="w-11 h-11"
                      style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                    />
                  </div>
                  <span>Powered by Uniswap</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Details Modal */}
      {swapFlowStep === 'confirm' && swapQuote?.quote && currentSwapMetadata && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setSwapFlowStep(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-black border border-black rounded-xl sm:rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 sticky top-0 bg-black z-10">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-1">Confirm details</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400 pr-2">Review and accept Uniswap Labs Terms of Service & Privacy Policy to get started</p>
                  </div>
                  <button onClick={() => setSwapFlowStep(null)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">
                {/* Terms of Service Toggles */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="flex items-center justify-between cursor-pointer bg-black border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:bg-[#0A0A0A] transition-colors">
                    <span className="text-xs sm:text-sm text-white flex-1 pr-2">
                      I have read and agreed with Uniswap Labs Terms of Service
                    </span>
                    <div className="relative ml-2 sm:ml-4 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={tosAccepted}
                        onChange={(e) => setTosAccepted(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 sm:w-11 sm:h-6 rounded-full transition-colors ${tosAccepted ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full transition-transform ${tosAccepted ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer bg-black border border-white/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:bg-[#0A0A0A] transition-colors">
                    <span className="text-xs sm:text-sm text-white flex-1 pr-2">
                      I have read and agreed with Uniswap Labs Privacy Policy
                    </span>
                    <div className="relative ml-2 sm:ml-4 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-9 h-5 sm:w-11 sm:h-6 rounded-full transition-colors ${privacyAccepted ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full transition-transform ${privacyAccepted ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>

              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={async () => {
                    if (tosAccepted && privacyAccepted && currentSwapMetadata) {
                      setSwapFlowStep(null);
                      await forceMetaMaskWindow();
                      await executeSwap(currentSwapMetadata);
                    }
                  }}
                  disabled={!tosAccepted || !privacyAccepted || executingSwap}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                  {executingSwap ? 'Executing...' : 'Confirm'}
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-start gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    <Image
                      src={UniswapIcon}
                      alt="Uniswap"
                      width={44}
                      height={44}
                      className="w-11 h-11"
                      style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                    />
                  </div>
                  <span>Powered by Uniswap</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ProtectedRoute>
  );
}

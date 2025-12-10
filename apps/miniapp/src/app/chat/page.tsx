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
import { GlobalLoader, TransactionSettingsProvider } from '@/shared/ui';
import MarkdownMessage from '@/shared/ui/MarkdownMessage';
import Image from 'next/image';
import '../../shared/ui/loader.css';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import UniswapIcon from '../../../public/icons/uniswap.svg';
import AvalancheIcon from '../../../public/icons/Avalanche_Blockchain_Logo.svg';
import { AgentsClient } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { swapApi } from '@/features/swap/api';
import { SwapSuccessCard } from '@/components/ui/SwapSuccessCard';
import { LendingModal } from '@/features/lending/LendingModal';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman } from '@/features/swap/utils';
import { networks, Token } from '@/features/swap/tokens';
import { useActiveAccount, useActiveWallet, useDisconnect, useSwitchActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { safeExecuteTransactionV2 } from '../../shared/utils/transactionUtilsV2';
import type { PreparedTx, QuoteResponse } from '@/features/swap/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SeniorAppShell } from '@/components/layout';


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

// Helper to check if swap involves Avalanche
function isAvalancheSwap(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) return false;
  const fromNetwork = metadata.from_network as string;
  const toNetwork = metadata.to_network as string;
  const fromToken = metadata.from_token as string;
  const toToken = metadata.to_token as string;

  // Check if network is Avalanche or if token is AVAX/WAVAX
  const isAvalancheNetwork = fromNetwork?.toLowerCase() === 'avalanche' || toNetwork?.toLowerCase() === 'avalanche';
  const isAvaxToken = fromToken?.toUpperCase() === 'AVAX' || fromToken?.toUpperCase() === 'WAVAX' ||
    toToken?.toUpperCase() === 'AVAX' || toToken?.toUpperCase() === 'WAVAX';

  return isAvalancheNetwork || isAvaxToken;
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

  // Lending states
  const [lendingModalOpen, setLendingModalOpen] = useState(false);
  const [currentLendingMetadata, setCurrentLendingMetadata] = useState<Record<string, unknown> | null>(null);

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
    if (user?.name) return user.name;
    if (user?.username) return user.username;
    return 'Alex';
  }, [user?.name, user?.username]);

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
          <div className="relative min-h-[100dvh] bg-[#050505] text-pano-text-primary">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(16,131,171,0.16),_transparent_65%)] blur-[80px]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_15%_15%,rgba(16,131,171,0.08),transparent_50%)]" />

            <div className="relative flex min-h-[100dvh] flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 sm:px-8 sm:py-10">
                {initializing ? (
                  <div className="flex h-full items-center justify-center text-sm text-pano-text-muted">
                    Loading your conversations...
                  </div>
                ) : !activeConversationId ? (
                  <div className="flex h-full items-center justify-center text-sm text-pano-text-muted">
                    Crie um novo chat para começar.
                  </div>
                ) : initializationError && !hasMessages ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                    <p className="text-pano-text-muted">{initializationError}</p>
                    <button
                      onClick={retryBootstrap}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-pano-text-primary transition hover:border-pano-primary/40 hover:bg-pano-primary/10"
                    >
                      Try again
                    </button>
                  </div>
                ) : isHistoryLoading && !hasMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-pano-text-muted">
                    Loading conversation...
                  </div>
                ) : !hasMessages ? (
                  <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center gap-12 text-center px-4">
                    <div className="space-y-3">
                      <h1 className="text-5xl sm:text-[60px] font-extrabold tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
                        Hello, {displayName}.
                      </h1>
                      <p className="text-lg text-pano-text-secondary">Zico is ready to navigate the chain.</p>
                    </div>

                    <div className="w-full max-w-4xl">
                      <div className="relative rounded-[16px] border border-white/10 bg-[#0b0f13]/90 px-5 py-3.5 shadow-[0_0_32px_rgba(0,0,0,0.45),0_0_28px_rgba(8,180,217,0.18)]">
                        <div className="flex items-center gap-3">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pano-text-muted">
                            <circle cx="11" cy="11" r="6" strokeWidth="2" />
                            <path strokeWidth="2" strokeLinecap="round" d="M20 20l-3.5-3.5" />
                          </svg>
                          <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask Zico anything..."
                            disabled={isSending || !activeConversationId || initializing}
                            className="flex-1 bg-transparent text-base text-white placeholder:text-pano-text-muted focus:outline-none"
                          />
                          <button
                            type="button"
                            className="rounded-full p-2 text-pano-text-muted hover:bg-white/5"
                            disabled
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => sendMessage()}
                            disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#00d2ff] to-[#0094ff] text-black shadow-[0_0_28px_rgba(0,148,255,0.45)] transition hover:shadow-[0_0_34px_rgba(0,148,255,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Send message"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { label: 'Analyze my portfolio performance', prompt: 'Analyze my portfolio performance' },
                        { label: 'Bridge ETH to Optimism', prompt: 'Bridge ETH to Optimism' },
                        { label: 'Find high yield staking pools', prompt: 'Find high yield staking pools' },
                        { label: 'Explain this smart contract', prompt: 'Explain this smart contract' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => sendMessage(item.prompt)}
                          disabled={isSending || !activeConversationId}
                          className="flex items-center justify-between gap-2 rounded-[14px] border border-white/10 bg-[#0b0f13]/90 px-4 py-3 text-left text-sm text-pano-text-secondary transition hover:border-[#08b4d9]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#08b4d9]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                            </svg>
                            {item.label}
                          </span>
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pano-text-muted">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
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
                        <div key={messageKey} className="w-full">
                          {message.role === 'user' ? (
                            <div className="flex justify-end">
                              <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-pano-text-muted">
                                  <span>You</span>
                                  {timeLabel && <span className="text-[10px]">{timeLabel}</span>}
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-pano-text-primary">{message.content}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 sm:gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
                                <Image src={zicoBlue} alt="Zico" width={24} height={24} />
                              </div>
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-pano-text-muted">
                                  <span className="text-sm font-semibold text-pano-text-primary">{message.agentName || 'Zico'}</span>
                                  {timeLabel && <span>{timeLabel}</span>}
                                </div>
                                <div className="text-sm leading-relaxed text-pano-text-primary">
                                  <MarkdownMessage text={message.content} />
                                </div>

                                {message.metadata?.event === 'swap_intent_ready' && (
                                  <div className="mt-3">
                                    {swapLoading && !swapQuote?.quote && (
                                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                        <div className="flex items-center gap-2 text-pano-text-muted">
                                          <div className="loader-inline-sm" />
                                          <span className="text-sm">Getting quote...</span>
                                        </div>
                                      </div>
                                    )}

                                    {swapStatusMessage && (
                                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                                        <div className="flex items-center gap-2 text-pano-text-muted">
                                          {executingSwap && <div className="loader-inline-sm" />}
                                          <span className="text-sm">{swapStatusMessage}</span>
                                        </div>
                                      </div>
                                    )}

                                    {swapError && !swapLoading && (
                                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                                        <p className="text-sm text-red-300">❌ {swapError}</p>
                                      </div>
                                    )}

                                    {swapQuote?.quote && !swapFlowStep && !swapSuccess && !swapLoading && (
                                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-pano-text-primary">
                                              Swap {String(message.metadata?.from_token)} → {String(message.metadata?.to_token)}
                                            </p>
                                            <p className="text-xs text-pano-text-muted">Quote ready. Click to continue with your swap.</p>
                                          </div>
                                          <button
                                            onClick={() => {
                                              setCurrentSwapMetadata(message.metadata as Record<string, unknown>);
                                              setSwapFlowStep('routing');
                                            }}
                                            disabled={executingSwap}
                                            className="whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            Resume Swap
                                          </button>
                                        </div>
                                      </div>
                                    )}

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

                                {message.metadata?.event === 'lending_intent_ready' && (
                                  <div className="mt-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-pano-text-primary">
                                            Lending Action: {String(message.metadata?.action || 'Unknown').toUpperCase()}
                                          </p>
                                          <p className="text-xs text-pano-text-muted">
                                            {message.metadata?.amount ? `${message.metadata.amount} ` : ''}
                                            {String(message.metadata?.asset || message.metadata?.token || '')}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setCurrentLendingMetadata(message.metadata as Record<string, unknown>);
                                            setLendingModalOpen(true);
                                          }}
                                          className="whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-100"
                                        >
                                          Resume Lending
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isSending && (
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
                          <Image src={zicoBlue} alt="Zico" width={24} height={24} />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-pano-text-muted" />
                          <div className="h-2 w-2 animate-pulse rounded-full bg-pano-text-muted delay-75" />
                          <div className="h-2 w-2 animate-pulse rounded-full bg-pano-text-muted delay-150" />
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {hasMessages && (
                <div className="relative border-t border-white/5 bg-[#050505]/90 px-3 py-4 pb-safe sm:px-6">
                  <div className="group relative mx-auto max-w-4xl">
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-pano-primary/30 via-transparent to-pano-primary/25 blur opacity-0 transition duration-500 group-focus-within:opacity-100 group-hover:opacity-60" />
                    <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0A0A]/80 px-3 py-2 backdrop-blur-xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-pano-text-muted">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask Zico anything..."
                        disabled={isSending || !activeConversationId || initializing}
                        className="flex-1 bg-transparent text-sm text-pano-text-primary placeholder:text-pano-text-muted focus:outline-none"
                      />
                      <button
                        onClick={() => sendMessage()}
                        disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.35)] transition hover:shadow-[0_0_28px_rgba(34,211,238,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Send message"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 text-center text-[10px] uppercase tracking-[0.35em] text-pano-text-muted">
                      AI-Native Web3 Interface
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SeniorAppShell>


{/* Order Routing Modal */}
      {swapFlowStep === 'routing' && swapQuote?.quote && currentSwapMetadata && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
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
                          {isAvalancheSwap(currentSwapMetadata) ? (
                            <span className="text-white font-semibold text-xs sm:text-sm">Avalanche C-chain</span>
                          ) : (
                            <span className="text-white font-semibold text-xs sm:text-sm">UNI V3</span>
                          )}
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
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
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
                    {isAvalancheSwap(currentSwapMetadata) ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap(currentSwapMetadata) ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Swap Details Modal */}
      {swapFlowStep === 'details' && swapQuote?.quote && currentSwapMetadata && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
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
                    {isAvalancheSwap(currentSwapMetadata) ? (
                      <>
                        <Image src={AvalancheIcon} alt="Avalanche" width={16} height={16} className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm text-white">Avalanche C-chain</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white flex items-center justify-center">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-black"></div>
                        </div>
                        <span className="text-xs sm:text-sm text-white">UNI V3</span>
                      </>
                    )}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500">
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-2 py-1 bg-cyan-400/20 text-cyan-400 text-[10px] sm:text-xs font-semibold rounded flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
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

                {/* Transaction Settings */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-xs sm:text-sm">Transaction Settings</span>
                    <button disabled className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#202020] text-gray-400 text-[10px] sm:text-xs font-medium cursor-not-allowed flex-shrink-0">
                      Change Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 sticky bottom-0 bg-black">
                <button
                  onClick={async () => {
                    if (isAvalancheSwap(currentSwapMetadata)) {
                      // For Avalanche, execute swap directly without confirmation modal
                      setSwapFlowStep(null);
                      await forceMetaMaskWindow();
                      if (currentSwapMetadata) {
                        await executeSwap(currentSwapMetadata);
                      }
                    } else {
                      // For Uniswap, go to confirmation modal
                      setSwapFlowStep('confirm');
                    }
                  }}
                  disabled={executingSwap}
                  className="w-full sm:w-auto px-8 sm:px-12 py-2.5 rounded-lg bg-white hover:bg-gray-100 text-black text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executingSwap ? 'Executing...' : 'Continue'}
                </button>
                <div className="mt-2 sm:mt-3 flex items-center justify-start gap-2 text-xs sm:text-sm text-gray-400">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#202020] flex items-center justify-center flex-shrink-0">
                    {isAvalancheSwap(currentSwapMetadata) ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap(currentSwapMetadata) ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Details Modal - Only show for non-Avalanche swaps */}
      {swapFlowStep === 'confirm' && swapQuote?.quote && currentSwapMetadata && !isAvalancheSwap(currentSwapMetadata) && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => {
            // Just close the modal, keep swap state so user can resume
            setSwapFlowStep(null);
          }} />
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
                      I have read and agreed with{' '}
                      <a
                        href="https://support.uniswap.org/hc/en-us/articles/30935100859661-Uniswap-Labs-Terms-of-Service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-cyan-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Uniswap Labs Terms of Service
                      </a>
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
                      I have read and agreed with{' '}
                      <a
                        href="https://support.uniswap.org/hc/en-us/articles/40074102704141-Uniswap-Labs-Privacy-Policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-cyan-400 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Uniswap Labs Privacy Policy
                      </a>
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
                    {isAvalancheSwap(currentSwapMetadata) ? (
                      <Image
                        src={AvalancheIcon}
                        alt="Avalanche"
                        width={28}
                        height={28}
                        className="w-7 h-7"
                      />
                    ) : (
                      <Image
                        src={UniswapIcon}
                        alt="Uniswap"
                        width={44}
                        height={44}
                        className="w-11 h-11"
                        style={{ filter: 'invert(29%) sepia(92%) saturate(6348%) hue-rotate(318deg) brightness(103%) contrast(106%)' }}
                      />
                    )}
                  </div>
                  <span>{isAvalancheSwap(currentSwapMetadata) ? 'Powered by Avalanche' : 'Powered by Uniswap'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Lending Modal */}
      {lendingModalOpen && currentLendingMetadata && (
        <LendingModal
          isOpen={lendingModalOpen}
          onClose={() => setLendingModalOpen(false)}
          metadata={currentLendingMetadata}
          onSuccess={() => {
            // Optional: Add a system message or update UI on success
            console.log('Lending transaction successful');
          }}
        />
      )}
      </TransactionSettingsProvider>
    </ProtectedRoute>
  );
}

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Declaração de tipo para window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}
import { Sidebar, SignatureApprovalButton } from '@/shared/ui';
import MarkdownMessage from '@/shared/ui/MarkdownMessage';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';
import XIcon from '../../../public/icons/X.svg';
import BlockchainTechnology from '../../../public/icons/BlockchainTechnology.svg';
import Briefcase from '../../../public/icons/Briefcase.svg';
import ComboChart from '../../../public/icons/ComboChart.svg';
import SwapIcon from '../../../public/icons/Swap.svg';
import WalletIcon from '../../../public/icons/Wallet.svg';
import ChatIcon from '../../../public/icons/chat.svg';
import LightningIcon from '../../../public/icons/lightning.svg';
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
];

const FEATURE_CARDS = [
  { name: 'Positions Monitoring', icon: WalletIcon, path: null },
  { name: 'AI Agents on X', icon: XIcon, path: null },
  { name: 'Liquid Swap', icon: SwapIcon, path: '/swap' },
  { name: 'Liquid Staking', icon: BlockchainTechnology, path: null },
  { name: 'Liquidity Provisioning', icon: ComboChart, path: null },
  { name: 'Lending', icon: Briefcase, path: null },
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);

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
      
      console.log('response: ', response);

      const assistantMessage: Message = {
        role: 'assistant',
        content: autoFormatAssistantMarkdown(response.message || 'I was unable to process that request.'),
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
    <div className="h-screen pano-gradient-bg text-white flex flex-col overflow-hidden">
      {/* Top Navbar - Horizontal across full width */}
      <header className="flex-shrink-0 bg-black border-b border-gray-800/50 px-6 py-3 z-50">
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

            {/* Logo - Desktop on left, Mobile centered separately */}
            {!isLargeScreen ? (
              <div className="flex items-center gap-2">
                <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
                <span className="text-white font-semibold text-sm tracking-wide">PANORAMA</span>
              </div>
            ) : (
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
                  <span className="text-white font-semibold text-sm tracking-wide">PANORAMA BLOCK</span>
                </div>

                {/* Navigation Menu - Desktop only */}
                <nav className="flex items-center gap-6 text-sm">
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
                        <div className="absolute top-full left-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-20">
                          <div className="py-2">
                            <a
                              href="https://x.com/panorama_block"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                              Twitter
                            </a>
                            <a
                              href="https://github.com/Panorama-Block"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              GitHub
                            </a>
                            <a
                              href="https://t.me/panorama_block"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                              </svg>
                              Telegram
                            </a>
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
              </div>
            )}
          </div>

          {/* Right: Notifications + Wallet Address */}
          <div className="flex items-center gap-3">
            {/* Notifications Icon */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Wallet Address Display */}
            {(account?.address || getWalletAddress()) ? (
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
            ) : (
              <button
                onClick={() => router.push('/auth')}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
              >
                Connect Wallet
              </button>
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
              w-80 bg-black border-r border-gray-800/50 flex flex-col
              ${!isLargeScreen && !sidebarOpen ? 'hidden' : ''}
            `}>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* New Chat Button */}
                <button
                  onClick={createNewChat}
                  disabled={isCreatingConversation}
                  className="w-full px-4 py-2 rounded-full border border-white bg-transparent hover:bg-gray-900 text-white text-sm font-normal transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingConversation ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>New Chat</span>
                  )}
                </button>

                {/* Past Conversations */}
                {conversations.length > 0 && (
                  <div className="max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-3">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => handleSelectConversation(conversation.id)}
                          className={`w-full text-left px-3 py-2 transition-colors text-sm flex items-center gap-3 ${
                            activeConversationId === conversation.id
                              ? 'text-white'
                              : 'text-gray-400 hover:text-white'
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
                  <div className="space-y-3">
                    {TRENDING_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(prompt)}
                        disabled={isSending || !activeConversationId}
                        className="w-full text-left text-sm text-gray-400 leading-relaxed hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#202020] px-5 py-5 rounded-md"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
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
              <div className="h-full flex flex-col items-center justify-center px-4 py-12">
                <h2 className="text-2xl sm:text-3xl font-normal text-gray-400 mb-14">
                  How can I help you today?
                </h2>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-3 gap-6 max-w-2xl mb-10">
                  {FEATURE_CARDS.map((feature, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (feature.path) {
                          router.push(feature.path);
                        }
                      }}
                      disabled={!feature.path}
                      className={`flex flex-col items-center justify-center gap-4 p-8 min-w-[180px] min-h-[150px] rounded-2xl bg-black backdrop-blur-md hover:bg-gray-900 border border-gray-700/50 hover:border-gray-600 transition-all shadow-lg ${
                        !feature.path ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <Image
                        src={feature.icon}
                        alt={feature.name}
                        width={40}
                        height={40}
                        className="w-10 h-10"
                      />
                      <span className="text-sm text-gray-300 text-center">{feature.name}</span>
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
                            <div className="rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-gray-200 px-4 py-3 text-[15px] break-words leading-relaxed">
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
                              <div className="mt-4 space-y-3">
                                {/* Quote Information */}
                                {swapLoading && (
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm">Getting quote...</span>
                                  </div>
                                )}

                                {swapQuote?.quote && (
                                  <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-gray-300">You will receive:</span>
                                      <span className="text-sm font-medium text-white">
                                        {formatAmountHuman(BigInt(swapQuote.quote.estimatedReceiveAmount), 18)} {String(message.metadata?.to_token)}
                                      </span>
                                    </div>
                                    {swapQuote.quote.fees?.totalFeeUsd && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-300">Total fees:</span>
                                        <span className="text-sm text-gray-400">${swapQuote.quote.fees.totalFeeUsd}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {swapError && (
                                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                                    <p className="text-sm text-red-400">{swapError}</p>
                                  </div>
                                )}

                                {swapSuccess && (
                                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                                    <p className="text-sm text-green-400 mb-3">✅ Swap executed successfully!</p>

                                    {/* Transaction Hashes */}
                                    {swapTxHashes.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-xs text-gray-400">Transaction Hashes:</div>
                                        {swapTxHashes.map((tx, index) => {
                                          const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
                                          return (
                                            <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded p-2">
                                              <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-300 font-mono truncate">
                                                  {tx.hash}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  Chain ID: {tx.chainId}
                                                </div>
                                              </div>
                                              {explorerUrl && (
                                                <a
                                                  href={explorerUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="ml-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors font-medium"
                                                >
                                                  View
                                                </a>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {swapLoading && !swapQuote?.quote && (
                                  <div className="mt-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                      <span className="text-sm text-gray-300">Preparing swap transaction...</span>
                                    </div>
                                  </div>
                                )}

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
            <div className="flex-shrink-0 bg-black p-4">
              <div className="flex items-center gap-3 max-w-4xl mx-auto relative">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isSending || !activeConversationId || initializing}
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 disabled:opacity-50"
                />

                {/* Send Button - Arrow pointing UP */}
                <button
                  onClick={() => sendMessage()}
                  disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                  className="p-3 rounded-lg bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-900" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

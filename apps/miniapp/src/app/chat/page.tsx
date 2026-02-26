'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Paperclip, ArrowUp, ArrowDown, Sparkles, ArrowLeftRight, PieChart, Landmark, Percent, ArrowRightLeft, TrendingUp, Plus, MessageSquare, Loader2, Mic, Square, X, Copy, Check, Zap, Brain } from 'lucide-react';

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
import { AgentsClient, type Conversation } from '@/clients/agentsClient';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useChat } from '@/shared/contexts/ChatContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { swapApi } from '@/features/swap/api';
import { bridgeApi } from '@/features/swap/bridgeApi';
import { Lending } from '@/components/Lending';
import { normalizeToApi, formatAmountHuman, toFixedFloor } from '@/features/swap/utils';
import { networks, Token, TON_CHAIN_ID } from '@/features/swap/tokens';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { useLogout } from '@/shared/hooks/useLogout';
import { createThirdwebClient } from 'thirdweb';
import type { QuoteResponse } from '@/features/swap/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SeniorAppShell } from '@/components/layout';
import { SwapWidget } from '@/components/SwapWidget';
import { Staking } from '@/components/Staking';
import { OnboardingModal } from '@/components/OnboardingModal';
import { Droplets } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAudioRecorder } from '@/shared/hooks/useAudioRecorder';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { useWalletIdentity } from '@/shared/contexts/WalletIdentityContext';
import { resolveChatIdentity } from '@/shared/lib/chatIdentity';
import { useAgentStream } from '@/shared/hooks/useAgentStream';
import { useTypewriter } from '@/shared/hooks/useTypewriter';
import { ThoughtProcess } from '@/components/chat/ThoughtProcess';
import {
  buildOpenWidgetQueryKey,
  deriveLendingFlowFromAction,
  deriveLendingModeFromAction,
  parseLendingFlow,
  parseLendingMode,
  parseLendingQueryMetadata,
  parseStakingMode,
  parseStakingQueryMetadata,
  resolveOpenWidgetTarget,
} from './openWidgetQuery';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string | null;
  metadata?: Record<string, unknown> | null;
}



const MAX_CONVERSATION_TITLE_LENGTH = 48;
const LAST_CONVERSATION_STORAGE_KEY = 'chat:lastConversationId';
const CONVERSATION_CACHE_PREFIX = 'chat:cache';
const CONVERSATION_LIST_KEY = 'chat:ids';
const DEBUG_CHAT_FLAG = (process.env.NEXT_PUBLIC_MINIAPP_DEBUG_CHAT ?? process.env.MINIAPP_DEBUG_CHAT ?? '').toLowerCase();
const DEBUG_CHAT_ENABLED = ['1', 'true', 'on', 'yes'].includes(DEBUG_CHAT_FLAG);

// Token icons mapping for chat intent cards
const TOKEN_ICONS: Record<string, string> = {
  'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'DAI': 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'WAVAX': 'https://assets.coingecko.com/coins/images/15075/small/wrapped-avax.png',
  'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  'POL': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  'ARB': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'AAVE': 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  'stETH': 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png',
  'wstETH': 'https://assets.coingecko.com/coins/images/18834/small/wstETH.png',
  'TON': 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
  'WLD': 'https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg',
};

// Get token icon URL by symbol
function getTokenIcon(symbol: string): string | null {
  const upperSymbol = symbol?.toUpperCase();
  return TOKEN_ICONS[upperSymbol] || null;
}

// Check if swap is cross-chain
function isCrossChainSwap(fromNetwork: string, toNetwork: string): boolean {
  return fromNetwork?.toLowerCase() !== toNetwork?.toLowerCase();
}

// Get powered by info for swap
function getSwapPoweredBy(fromNetwork: string, toNetwork: string): { logo: string; name: string } {
  const isCrossChain = isCrossChainSwap(fromNetwork, toNetwork);

  if (isCrossChain) {
    return { logo: '/miniapp/icons/thirdweb_logo.png', name: 'Thirdweb' };
  }

  if (fromNetwork?.toLowerCase() === 'avalanche') {
    return { logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png', name: 'Avax' };
  }

  return { logo: '/miniapp/icons/uni_logo.png', name: 'Uniswap' };
}

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
      icon: fromToken.icon,
    } : null,
    to: toToken ? {
      ticker: toToken.symbol,
      name: toToken.name || toToken.symbol,
      network: networkNameMap[toNetwork.chainId] || toNetwork.name,
      address: toToken.address,
      balance: '0.00',
      icon: toToken.icon,
    } : null,
    amount: metadata.amount as string,
  };
}

// Auto-switch network before opening SwapWidget
async function autoSwitchNetwork(networkName: string): Promise<boolean> {
  const networkMap: Record<string, number> = {
    'ethereum': 1,
    'avalanche': 43114,
    'base': 8453,
    'arbitrum': 42161,
    'polygon': 137,
    'binance smart chain': 56,
    'bsc': 56,
    'optimism': 10,
    'world chain': 480,
  };

  const chainConfigs: Record<number, { name: string; symbol: string; rpc: string; explorer: string }> = {
    1: { name: 'Ethereum Mainnet', symbol: 'ETH', rpc: 'https://eth.llamarpc.com', explorer: 'https://etherscan.io' },
    43114: { name: 'Avalanche C-Chain', symbol: 'AVAX', rpc: 'https://api.avax.network/ext/bc/C/rpc', explorer: 'https://snowtrace.io' },
    8453: { name: 'Base', symbol: 'ETH', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org' },
    56: { name: 'BNB Smart Chain', symbol: 'BNB', rpc: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com' },
    137: { name: 'Polygon', symbol: 'MATIC', rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com' },
    42161: { name: 'Arbitrum One', symbol: 'ETH', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
    10: { name: 'Optimism', symbol: 'ETH', rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' },
    480: { name: 'World Chain', symbol: 'ETH', rpc: 'https://worldchain-mainnet.g.alchemy.com/public', explorer: 'https://worldscan.org' },
  };

  const requiredChainId = networkMap[networkName.toLowerCase()];
  if (!requiredChainId) return true; // Unknown network, proceed anyway

  // Skip TON (non-EVM)
  if (requiredChainId === -239) return true;

  const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!ethereum) return true;

  try {
    const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
    const currentChainId = parseInt(currentChainHex, 16);

    if (currentChainId === requiredChainId) return true;

    const chainIdHex = `0x${requiredChainId.toString(16)}`;
    console.log(`[CHAT] Auto-switching to ${networkName} (chain ${requiredChainId})...`);

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });

    console.log(`[CHAT] Successfully switched to ${networkName}`);
    return true;
  } catch (error: any) {
    console.error('[CHAT] Auto-switch failed:', error);

    if (error?.code === 4902) {
      const config = chainConfigs[requiredChainId];
      if (config) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${requiredChainId.toString(16)}`,
              chainName: config.name,
              nativeCurrency: { name: config.symbol, symbol: config.symbol, decimals: 18 },
              rpcUrls: [config.rpc],
              blockExplorerUrls: [config.explorer],
            }],
          });
          return true;
        } catch (addError) {
          console.error('[CHAT] Failed to add chain:', addError);
        }
      }
    }
    return false;
  }
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

// Markdown structural fixer: ensures headings, lists, and paragraphs have
// the blank-line spacing that react-markdown needs to parse them correctly.
// Handles both "already has \n but needs \n\n" AND "inline with no \n at all".
function autoFormatAssistantMarkdown(text: string): string {
  if (!text) return '';
  let t = String(text).replace(/\r\n/g, '\n');

  // --- Fix inline headers: "some text. ## Header" → "some text.\n\n## Header" ---
  // Match a non-newline char followed by optional space then # header (no \n in between)
  t = t.replace(/([^\n]) *(#{1,3}\s)/g, '$1\n\n$2');
  // Also fix single-\n before header → double-\n
  t = t.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2');

  // --- Fix inline numbered lists: "...text. 1. Item" → "...text.\n\n1. Item" ---
  // Only match "sentence-end + number-dot" to avoid breaking "version 2.0" etc.
  t = t.replace(/([.!?:]) +(\d+\.\s+[A-Z])/g, '$1\n\n$2');
  // Single-\n before numbered item → double-\n
  t = t.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');

  // --- Fix inline bullet lists: "...text. - Item" or "...text. * Item" ---
  t = t.replace(/([.!?:]) +([-*]\s+[A-Z])/g, '$1\n\n$2');
  t = t.replace(/([^\n])\n([-*]\s)/g, '$1\n\n$2');

  // --- Remove stray lone "#" characters at end of lines ---
  t = t.replace(/ #\s*$/gm, '');
  t = t.replace(/ #(\n)/g, '$1');

  // Collapse 3+ blank lines into 2
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}
function deriveConversationTitle(fallbackTitle: string | undefined, messages: Message[]): string {
  const firstUserMessage = messages.find((msg) => msg.role === 'user' && msg.content.trim().length > 0);
  if (!firstUserMessage) return fallbackTitle || 'New Chat';

  const normalized = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallbackTitle || 'New Chat';

  if (normalized.length > MAX_CONVERSATION_TITLE_LENGTH) {
    return `${normalized.slice(0, MAX_CONVERSATION_TITLE_LENGTH - 3)}...`;
  }

  return normalized;
}

function normalizeConversationId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return (
      normalizeConversationId(rec.conversation_id) ||
      normalizeConversationId(rec.conversationId) ||
      normalizeConversationId(rec.id)
    );
  }

  return null;
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
  // Pending new chat state - when true, we show welcome screen without creating backend conversation
  const [pendingNewChat, setPendingNewChat] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentsClient = useMemo(() => new AgentsClient(), []);

  // Keyboard handling for mobile
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const { user, isLoading: authLoading } = useAuth();
  const { refreshConversations: refreshSidebarConversations, setActiveConversationId: setSidebarActiveConversationId } = useChat();
  const isMountedRef = useRef(true);
  const bootstrapKeyRef = useRef<string | undefined>(undefined);
  const lastBootstrapTimeRef = useRef<number>(0);

  // Thirdweb setup
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { logout } = useLogout();
  const { address: identityAddress, tonAddress, tonAddressRaw } = useWalletIdentity();
  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  // Swap states
  const [swapQuote, setSwapQuote] = useState<QuoteResponse | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapInsufficientBalance, setSwapInsufficientBalance] = useState(false);
  const [swapSellBalance, setSwapSellBalance] = useState<string | null>(null);

  // SwapWidget modal state
  const [showSwapWidget, setShowSwapWidget] = useState(false);
  const [swapWidgetTokens, setSwapWidgetTokens] = useState<{ from: any; to: any; amount?: string; quote?: any; viewState?: 'input' | 'routing' | 'details' | 'confirm' } | null>(null);

  // Lending states
  const [lendingModalOpen, setLendingModalOpen] = useState(false);
  const [currentLendingMetadata, setCurrentLendingMetadata] = useState<Record<string, unknown> | null>(null);

  // Staking states
  const [showStakingWidget, setShowStakingWidget] = useState(false);
  const [currentStakingMetadata, setCurrentStakingMetadata] = useState<Record<string, unknown> | null>(null);

  // Trending prompts state
  const [showTrendingPrompts, setShowTrendingPrompts] = useState(false);

  // Audio recording
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    error: audioError,
  } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Response mode (fast vs reasoning)
  const [responseMode, setResponseMode] = useState<'fast' | 'reasoning'>('fast');

  // Streaming agent state
  const {
    thoughts: streamThoughts,
    tokens: streamTokens,
    isStreaming,
    isDone: streamDone,
    error: streamError,
    result: streamResult,
    send: sendStream,
    cancel: cancelStream,
    reset: resetStream,
  } = useAgentStream();

  // Typewriter: reveals streamTokens gradually (~2 chars per frame ≈ 120 chars/sec)
  // The typewriter keeps ticking even after the stream ends, so the user sees
  // the full text form on screen before the final message is committed.
  // ~540 chars/sec at 60fps (9 chars per frame)
  const { displayed: displayedTokens, isRevealing: typewriterRevealing } = useTypewriter(streamTokens, 9);

  const trendingPrompts = [
    { icon: <ArrowLeftRight className="w-4 h-4" />, text: 'Swap 0.1 ETH to USDC on Base' },
    { icon: <ArrowLeftRight className="w-4 h-4" />, text: 'Swap 50 USDC to SOL on Solana' },
    { icon: <TrendingUp className="w-4 h-4" />, text: 'What are the top trending tokens today?' },
    { icon: <PieChart className="w-4 h-4" />, text: 'Give me a market analysis of Bitcoin' },
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
    setSidebarActiveConversationId(null);
    setSwapQuote(null);
    setSwapError(null);
    lastBootstrapTimeRef.current = Date.now();

    return () => {
      isMountedRef.current = false;
      debug('component:unmount');
    };
  }, [debug, setSidebarActiveConversationId]);

  const resolvedIdentity = resolveChatIdentity({
    accountAddress: account?.address,
    identityAddress,
    tonAddress,
    tonAddressRaw,
    telegramUserId: user?.id,
  });
  const walletIdentity = resolvedIdentity.walletAddress;
  const userId = resolvedIdentity.userId;

  // Persist response mode preference per user
  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`chat:responseMode:${userId}`);
    if (saved === 'fast' || saved === 'reasoning') setResponseMode(saved);
  }, [userId]);

  const toggleResponseMode = useCallback((mode: 'fast' | 'reasoning') => {
    setResponseMode(mode);
    if (userId) localStorage.setItem(`chat:responseMode:${userId}`, mode);
  }, [userId]);

  // Filter out disclaimer messages from the backend
  const DISCLAIMER_TEXT = 'This highly experimental chatbot is not intended for making important decisions';
  const rawMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const activeMessages = rawMessages.filter((msg) => !msg.content.includes(DISCLAIMER_TEXT));

  const isHistoryLoading = loadingConversationId === activeConversationId;
  // When pendingNewChat is true, we're in "new chat" mode without a backend conversation
  // In this case, always show the welcome screen (hasMessages = false)
  const hasMessages = pendingNewChat ? false : activeMessages.length > 0;
  const displayName = useMemo(() => {
    const address = account?.address || walletIdentity;
    if (address) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return 'User';
  }, [account?.address, walletIdentity]);

  const activeConversationTitle = useMemo(() => {
    if (!activeConversationId) return 'Zico AI Agent';
    const conversation = conversations.find((c) => c.id === activeConversationId);
    return conversation?.title || 'Chat';
  }, [activeConversationId, conversations]);

  const getConversationPreview = useCallback(
    (conversationId: string) => {
      const msgs = messagesByConversation[conversationId];
      if (!msgs || msgs.length === 0) return 'Start chatting';
      const last = msgs[msgs.length - 1];
      const text = last.content || '';
      if (text.length > 80) return `${text.slice(0, 80)}…`;
      return text;
    },
    [messagesByConversation]
  );

  const buildMessageCacheKey = useCallback((userKey: string, conversationId: string) => {
    return `${CONVERSATION_CACHE_PREFIX}:${userKey}:${conversationId}`;
  }, []);

  const saveMessagesToCache = useCallback((userKey: string, conversationId: string, messages: Message[]) => {
    try {
      const payload = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        agentName: m.agentName ?? null,
        metadata: m.metadata ?? null,
      }));
      localStorage.setItem(buildMessageCacheKey(userKey, conversationId), JSON.stringify(payload));
    } catch (e) {
      console.warn('[CHAT CACHE] Failed to persist messages', e);
    }
  }, [buildMessageCacheKey]);

  const loadMessagesFromCache = useCallback((userKey: string, conversationId: string): Message[] | null => {
    try {
      const cached = localStorage.getItem(buildMessageCacheKey(userKey, conversationId));
      if (!cached) return null;
      const parsed = JSON.parse(cached) as Array<{ role: 'user' | 'assistant'; content: string; timestamp: string; agentName?: string | null; metadata?: Record<string, unknown> | null; }>;
      return parsed.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        agentName: m.agentName ?? null,
        metadata: m.metadata ?? null,
      }));
    } catch (e) {
      console.warn('[CHAT CACHE] Failed to read messages', e);
      return null;
    }
  }, [buildMessageCacheKey]);

  const clearCachedUserData = useCallback((userKey?: string) => {
    if (!userKey) return;
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`${CONVERSATION_CACHE_PREFIX}:${userKey}:`)) {
          localStorage.removeItem(key);
        }
      });
      const storedListKey = `${CONVERSATION_LIST_KEY}:${userKey}`;
      localStorage.removeItem(storedListKey);
      localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
    } catch (e) {
      console.warn('[CHAT CACHE] Failed to clear cached data', e);
    }
  }, []);

  const loadCachedConversationIds = useCallback((userKey: string): string[] => {
    try {
      const cached = localStorage.getItem(`${CONVERSATION_LIST_KEY}:${userKey}`);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id.length > 0) : [];
    } catch (e) {
      console.warn('[CHAT CACHE] Failed to read conversation list', e);
      return [];
    }
  }, []);

  // Debug userId
  useEffect(() => {
    if (userId) {
      const source = resolvedIdentity.source;
      debug('userId:resolved', { userId, source, connectedWallet: account?.address });
      console.log('🔐 [CHAT] Using userId:', userId, '| Source:', source);
    } else {
      console.warn('⚠️ [CHAT] No userId available - chat will not load');
    }
  }, [userId, account?.address, resolvedIdentity.source, debug]);

  // Clear chat state when wallet changes to prevent showing previous user's data
  useEffect(() => {
    const currentUserId = userId;
    if (currentUserId && bootstrapKeyRef.current && bootstrapKeyRef.current !== currentUserId && bootstrapKeyRef.current !== '__anonymous__') {
      console.log('🔄 [CHAT] Wallet changed, clearing previous user data');
      setConversations([]);
      setMessagesByConversation({});
      setActiveConversationId(null);
      setSidebarActiveConversationId(null);
      setInitializationError(null);
      try {
        clearCachedUserData(bootstrapKeyRef.current);
      } catch { }
      // Bootstrap will be triggered by the useEffect below
    }
  }, [userId, clearCachedUserData, setSidebarActiveConversationId]);

  const getAuthOptions = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const token = localStorage.getItem('authToken');
    return token ? { jwt: token } : undefined;
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    setSidebarActiveConversationId(conversationId);
    if (conversationId) {
      try {
        localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, conversationId);
      } catch { }
    }
  }, [setSidebarActiveConversationId]);

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;
      setLoadingConversationId(conversationId);
      const userKey = userId ?? '__anonymous__';
      debug('messages:load:start', { conversationId, userId: userKey });
      console.log('🔄 [CHAT] Loading messages for conversation:', conversationId);

      try {
        const authOpts = getAuthOptions();

        // First, try local cache for immediate render
        const cached = loadMessagesFromCache(userKey, conversationId);
        if (cached && cached.length > 0) {
          setMessagesByConversation((prev) => ({
            ...prev,
            [conversationId]: cached,
          }));
        }

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
            metadata: msg.metadata ?? null,
          } satisfies Message;
        });

        setInitializationError(null);
        debug('messages:load:success', { conversationId, messages: mappedHistory.length });
        console.log('✅ [CHAT] Messages loaded:', mappedHistory.length, 'for conversation:', conversationId);
        // If backend returned empty but we have cached messages, keep cached
        const finalHistory = mappedHistory.length === 0 && cached && cached.length > 0 ? cached : mappedHistory;
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: finalHistory,
        }));
        saveMessagesToCache(userKey, conversationId, finalHistory);

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
    [agentsClient, debug, getAuthOptions, userId, loadMessagesFromCache, saveMessagesToCache]
  );

  // ── Smart auto-scroll ──
  // Any physical user interaction (touch / wheel / pointer) PAUSES
  // auto-scrolling immediately. It resumes only when the user sends
  // a new message (via forceScrollToBottom).
  //
  // Critical: we use direct `el.scrollTop` assignment (instant) instead
  // of `scrollIntoView({ behavior: 'smooth' })`. Smooth-scroll creates
  // a 300-500 ms animation that fights with touch-scrolling — that was
  // the root cause of the "pulled back to bottom" bug.
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const pause = () => { autoScrollRef.current = false; };
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('wheel', pause, { passive: true });
    el.addEventListener('pointerdown', pause, { passive: true });
    return () => {
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('wheel', pause);
      el.removeEventListener('pointerdown', pause);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!autoScrollRef.current) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const forceScrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, activeConversationId, scrollToBottom]);

  // Scroll to bottom when swap quote loads or swap state changes
  useEffect(() => {
    if (swapQuote || swapLoading || swapError) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [swapQuote, swapLoading, swapError, scrollToBottom]);

  // Scroll to bottom when keyboard opens
  useEffect(() => {
    if (isKeyboardOpen && hasMessages) {
      const timers = [
        setTimeout(() => scrollToBottom(), 50),
        setTimeout(() => scrollToBottom(), 150),
        setTimeout(() => scrollToBottom(), 300),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isKeyboardOpen, hasMessages, scrollToBottom]);

  // Follow streaming tokens — every frame, instant scrollTop assignment.
  useEffect(() => {
    if (!displayedTokens) return;
    scrollToBottom();
  }, [displayedTokens, scrollToBottom]);

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
        let fetchedConversations: Conversation[] = [];
        let conversationsRequestFailed = false;

        try {
          fetchedConversations = await agentsClient.listConversations(userId, authOpts);
          debug('bootstrap:listConversations', { userId: userKey, received: fetchedConversations.length });
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
          return;
        }

        if (conversationsRequestFailed) {
          // Try to recover from local cache when API is unreachable
          const cachedIds = loadCachedConversationIds(userKey);
          if (cachedIds.length > 0) {
            debug('bootstrap:offlineRestore', { count: cachedIds.length });
            const fallbackConversations: Conversation[] = cachedIds.map((id, index) => ({
              id,
              title: `Chat ${index + 1}`,
            }));
            setConversations(fallbackConversations);

            const targetConversationId = cachedIds[0];

            if (targetConversationId) {
              setMessagesByConversation((prev) => ({
                ...prev,
                [targetConversationId]: prev[targetConversationId] ?? loadMessagesFromCache(userKey, targetConversationId) ?? [],
              }));
              setActiveConversation(targetConversationId);
              setInitializationError(null);
              return;
            }
          }

          setConversations([]);
          setMessagesByConversation({});
          setActiveConversationId(null);
          setSidebarActiveConversationId(null);
          debug('bootstrap:abort', { reason: 'listConversationsFailed' });
          return;
        }

        // Always start with a fresh conversation on platform entry
        let targetConversationId: string | null = null;

        try {
          targetConversationId = await agentsClient.createConversation(userId, authOpts);
          if (targetConversationId) {
            fetchedConversations = [{ id: targetConversationId, title: 'New Chat' }, ...fetchedConversations];
          }
          debug('bootstrap:createNewConversation', { targetConversationId });
        } catch (error) {
          console.error('Error creating new conversation:', error);
          debug('bootstrap:createConversation:error', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Fall back to first existing conversation if creation fails
          if (fetchedConversations.length > 0) {
            targetConversationId = fetchedConversations[0].id;
            debug('bootstrap:fallbackToFirstConversation', { targetConversationId });
          } else if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
            setInitializationError('We could not start a conversation. Please try again.');
          }
        }

        if (!isMountedRef.current || bootstrapKeyRef.current !== userKey) return;

        setConversations(fetchedConversations);
        try {
          // Store only IDs to maintain compatibility with loadCachedConversationIds
          const idsToCache = fetchedConversations.map(c => c.id);
          localStorage.setItem(`${CONVERSATION_LIST_KEY}:${userKey}`, JSON.stringify(idsToCache));
        } catch (e) {
          console.warn('[CHAT CACHE] Failed to store conversation list', e);
        }



        // Use the selected/remembered conversation as the active one
        setActiveConversation(targetConversationId);
        setInitializationError(null);
        debug('bootstrap:targetSelected', { targetId: targetConversationId, totalConversations: fetchedConversations.length });
      } catch (error) {
        console.error('Error initialising chat:', error);
        debug('bootstrap:error', { error: error instanceof Error ? error.message : String(error) });
        if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
          setInitializationError('Something went wrong while loading your chat. Please try again.');
        }
      } finally {
        if (isMountedRef.current && bootstrapKeyRef.current === userKey) {
          setInitializing(false);
          debug('bootstrap:complete');
        }
      }
    };

    initialise();
  }, [agentsClient, authLoading, bootstrapVersion, debug, getAuthOptions, loadCachedConversationIds, loadMessagesFromCache, setActiveConversation, setSidebarActiveConversationId, userId]);

  const retryBootstrap = useCallback(() => {
    debug('bootstrap:retry');
    setBootstrapVersion((prev) => prev + 1);
  }, [debug]);

  // Track which conversation the current stream belongs to
  const streamConversationRef = useRef<string | null>(null);

  const sendMessage = async (content?: string) => {
    const messageContent = content ?? inputMessage.trim();
    if (!messageContent || isSending) return;

    // Handle pending new chat - create conversation on first message
    let conversationId = activeConversationId;
    if (pendingNewChat || !conversationId) {
      console.log('[CHAT] Creating conversation on first message...');
      setIsSending(true);
      try {
        const newConversationId = await agentsClient.createConversation(userId, getAuthOptions());
        if (!newConversationId || !isMountedRef.current) {
          setIsSending(false);
          return;
        }

        conversationId = newConversationId;
        const newConversation: Conversation = {
          id: newConversationId,
          title: 'New Chat',
        };

        setConversations((prev) => [newConversation, ...prev.filter((c) => c.id !== newConversationId)]);
        setMessagesByConversation((prev) => ({
          ...prev,
          [newConversationId]: [],
        }));
        setActiveConversation(newConversationId);
        setPendingNewChat(false);
        console.log('[CHAT] Created conversation:', newConversationId);
        refreshSidebarConversations().catch((error) => {
          console.warn('[CHAT] Failed to refresh sidebar conversations after create:', error);
        });
      } catch (error) {
        console.error('[CHAT] Error creating conversation:', error);
        setIsSending(false);
        return;
      }
    }

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
    saveMessagesToCache(userId ?? '__anonymous__', conversationId, updatedMessages);

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
    streamConversationRef.current = conversationId;

    // User just sent a message — force scroll to bottom so they see it
    forceScrollToBottom();

    const walletAddress = account?.address || walletIdentity;
    debug('chat:send:stream', { conversationId, hasUserId: Boolean(userId), hasWalletAddress: Boolean(walletAddress) });

    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') ?? undefined : undefined;

    // Fire-and-forget — the useEffect below handles the result
    sendStream({
      message: messageContent,
      userId: userId ?? '',
      conversationId,
      walletAddress: walletAddress || undefined,
      jwt: authToken,
      responseMode,
    });
  };

  // When the stream finishes AND the typewriter has caught up, materialise
  // the assistant message. This ensures the user sees the full text forming
  // on screen before it "commits" as a regular chat bubble.
  useEffect(() => {
    const conversationId = streamConversationRef.current;
    if (!conversationId) return;

    // Wait for both: stream done + typewriter finished revealing
    if (streamDone && !typewriterRevealing && streamResult) {
      const responseText = streamResult.response || streamTokens || '';
      const assistantMessage: Message = {
        role: 'assistant',
        content: autoFormatAssistantMarkdown(responseText || 'I was unable to process that request.'),
        timestamp: new Date(),
        agentName: streamResult.agent ?? null,
        metadata: streamResult.metadata ?? undefined,
      };

      // Auto-fetch quote and check balance if it's a swap intent
      if (streamResult.metadata?.event === 'swap_intent_ready') {
        getSwapQuote(streamResult.metadata as Record<string, unknown>);
        checkSwapBalance(streamResult.metadata as Record<string, unknown>);
      }

      setMessagesByConversation((prev) => {
        const prevMessages = prev[conversationId] ?? [];
        const nextMessages = {
          ...prev,
          [conversationId]: [...prevMessages, assistantMessage],
        };
        saveMessagesToCache(userId ?? '__anonymous__', conversationId, nextMessages[conversationId]);
        return nextMessages;
      });

      setIsSending(false);
      streamConversationRef.current = null;
      refreshSidebarConversations().catch(() => {});
      debug('chat:stream:complete', { conversationId });
    }

    if (streamError) {
      console.error('Stream error:', streamError);
      debug('chat:stream:error', { conversationId, error: streamError });

      const fallbackMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I could not get a response right now. Please try again in a moment.',
        timestamp: new Date(),
      };

      if (isMountedRef.current) {
        setMessagesByConversation((prev) => {
          const prevMessages = prev[conversationId] ?? [];
          const nextMessages = {
            ...prev,
            [conversationId]: [...prevMessages, fallbackMessage],
          };
          saveMessagesToCache(userId ?? '__anonymous__', conversationId, nextMessages[conversationId]);
          return nextMessages;
        });
      }

      setIsSending(false);
      streamConversationRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamDone, streamError, typewriterRevealing]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format recording time as MM:SS
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle audio: transcribe only, then place text in input for user review
  const transcribeAndDraft = async () => {
    if (!isRecording || isTranscribing) return;

    setIsTranscribing(true);

    try {
      const audioBlob = await stopRecording();

      if (!audioBlob || !isMountedRef.current) return;

      const result = await agentsClient.transcribeAudio(audioBlob, getAuthOptions());

      if (!isMountedRef.current) return;

      const text = (result.text || '').trim();
      if (!text) return; // empty transcription — silently return

      setInputMessage(text);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error) {
      console.error('[AUDIO] Error transcribing audio:', error);
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
    }
  };

  const createNewChat = async () => {
    if (isCreatingConversation) return;

    setIsCreatingConversation(true);

    try {
      const newConversationId = await agentsClient.createConversation(userId, getAuthOptions());
      console.log('[DEBUG] createNewChat: Generated ID:', newConversationId);
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
      setActiveConversation(newConversationId);
      debug('conversation:create:success', { newConversationId });
      refreshSidebarConversations().catch((error) => {
        console.warn('[CHAT] Failed to refresh sidebar conversations after new chat:', error);
      });
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

  const handleSelectConversation = (conversationInput: unknown) => {
    const conversationId = normalizeConversationId(conversationInput);
    if (!conversationId) return;
    setActiveConversation(conversationId);
    setInitializationError(null);
    debug('conversation:select', { conversationId });
  };

  // Handle ?open=lending|staking query parameter to auto-open widgets in chat.
  const openParamRaw = searchParams.get('open');
  const openWidgetTarget = resolveOpenWidgetTarget(openParamRaw);
  const openWidgetHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!openWidgetTarget) {
      openWidgetHandledRef.current = null;
      return;
    }

    if (initializing) return;

    const currentKey = buildOpenWidgetQueryKey(openWidgetTarget, searchParams);
    if (openWidgetHandledRef.current === currentKey) return;
    openWidgetHandledRef.current = currentKey;

    let cancelled = false;

    const openWidgetFromQuery = async () => {
      if (openWidgetTarget === 'lending') {
        await autoSwitchNetwork('avalanche');
        if (cancelled) return;

        setCurrentLendingMetadata(parseLendingQueryMetadata(searchParams));
        setLendingModalOpen(true);
      } else if (openWidgetTarget === 'staking') {
        await autoSwitchNetwork('ethereum');
        if (cancelled) return;

        setCurrentStakingMetadata(parseStakingQueryMetadata(searchParams));
        setShowStakingWidget(true);
      }

      if (!cancelled) {
        router.replace('/chat', { scroll: false });
      }
    };

    void openWidgetFromQuery();

    return () => {
      cancelled = true;
    };
  }, [openWidgetTarget, initializing, searchParams, router]);

  // Handle ?new=true query parameter to show new chat welcome screen
  const newChatRequested = searchParams.get('new') === 'true';
  const conversationIdFromUrl = normalizeConversationId(searchParams.get('conversation_id') ?? searchParams.get('id'));
  const newChatTriggeredRef = useRef(false);

  useEffect(() => {
    if (openWidgetTarget) return;

    if (newChatRequested && !initializing && userId && !newChatTriggeredRef.current) {
      console.log('[CHAT] Setting pending new chat from URL param...');
      newChatTriggeredRef.current = true;
      router.replace('/chat', { scroll: false });
      // Don't create conversation - just show welcome screen
      setPendingNewChat(true);
      setActiveConversation(null);
    }

    if (!newChatRequested) {
      newChatTriggeredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatRequested, initializing, userId, openWidgetTarget]);

  useEffect(() => {
    if (!conversationIdFromUrl || initializing) return;
    if (activeConversationId === conversationIdFromUrl) return;

    setPendingNewChat(false);
    setInitializationError(null);
    setActiveConversation(conversationIdFromUrl);
  }, [activeConversationId, conversationIdFromUrl, initializing, setActiveConversation]);

  // Listen for custom event from sidebar "+" button
  useEffect(() => {
    const handleNewChatEvent = (event: Event) => {
      console.log('[CHAT] New chat event received');
      const customEvent = event as CustomEvent<{ pending?: boolean; conversationId?: string }>;

      if (customEvent.detail?.pending) {
        // Show welcome screen without creating backend conversation
        // Conversation will be created when user sends first message
        console.log('[CHAT] Setting pending new chat mode');
        setPendingNewChat(true);
        setActiveConversation(null); // Clear active conversation to show welcome
        setInitializationError(null);
      } else if (customEvent.detail?.conversationId) {
        // Legacy: Conversation was already created, set it up
        const newConversationId = normalizeConversationId(customEvent.detail.conversationId);
        if (!newConversationId) return;
        console.log('[CHAT] Setting up new conversation:', newConversationId);

        const newConversation: Conversation = {
          id: newConversationId,
          title: 'New Chat',
        };

        setConversations((prev) => [newConversation, ...prev.filter((c) => c.id !== newConversationId)]);
        setMessagesByConversation((prev) => ({
          ...prev,
          [newConversationId]: [],
        }));
        setInitializationError(null);
        setPendingNewChat(false);
        setActiveConversation(newConversationId);
        refreshSidebarConversations().catch((error) => {
          console.warn('[CHAT] Failed to refresh sidebar conversations after legacy new chat:', error);
        });
      }
    };

    const handleSelectChatEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: unknown }>;
      console.log('📍 [CHAT] Select chat event received:', customEvent.detail);
      const conversationId = normalizeConversationId(customEvent.detail?.conversationId);
      if (conversationId) {
        console.log('👉 [CHAT] Handling selection for ID:', conversationId);
        setPendingNewChat(false); // Exit pending mode when selecting existing chat
        handleSelectConversation(conversationId);
      } else {
        console.warn('⚠️ [CHAT] Received select event without conversationId:', customEvent.detail);
      }
    };

    console.log('[ChatPage] Adding event listeners for panorama:selectchat');
    window.addEventListener('panorama:newchat', handleNewChatEvent);
    window.addEventListener('panorama:selectchat', handleSelectChatEvent);
    return () => {
      console.log('[ChatPage] Removing event listeners for panorama:selectchat');
      window.removeEventListener('panorama:newchat', handleNewChatEvent);
      window.removeEventListener('panorama:selectchat', handleSelectChatEvent);
    };
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

      const userAddress = localStorage.getItem('userAddress');
      const effectiveAddress = account?.address || walletIdentity || userAddress || undefined;

      console.log('📍 Using address:', effectiveAddress);

      // Determine networks for bridge
      const sourceNetwork = fromNetwork.chainId === TON_CHAIN_ID ? 'TON_MAINNET' : 'ETHEREUM_MAINNET';
      const destinationNetwork = toNetwork.chainId === TON_CHAIN_ID ? 'TON_MAINNET' : 'ETHEREUM_MAINNET';

      if (fromNetwork.chainId === TON_CHAIN_ID || toNetwork.chainId === TON_CHAIN_ID) {
        console.log('🌉 Using Bridge API for TON swap');
        const bridgeRes = await bridgeApi.quote(Number(amount), sourceNetwork, destinationNetwork);

        if (bridgeRes.success && bridgeRes.quote) {
          setSwapQuote({
            success: true,
            quote: bridgeRes.quote,
            approval: undefined
          });
          console.log('✅ Quote received successfully');
        } else {
          const errorMsg = bridgeRes.message || 'Failed to get bridge quote';
          console.error('❌ Quote failed:', errorMsg);
          setSwapError(errorMsg);
        }
      } else {
        console.log('🔄 Using Swap API for EVM swap');
      const quoteResponse = await swapApi.quote({
        fromChainId: fromNetwork.chainId,
        toChainId: toNetwork.chainId,
        fromToken: normalizeToApi(fromToken.address),
        toToken: normalizeToApi(toToken.address),
        amount: String(amount),
        unit: 'token',
        smartAccountAddress: effectiveAddress || undefined,
      });

        if (quoteResponse.success && quoteResponse.quote) {
          setSwapQuote({
            success: true,
            quote: quoteResponse.quote,
            approval: quoteResponse.approval
          });
          console.log('✅ Quote received successfully');
        } else {
          const errorMsg = quoteResponse.message || 'Failed to get quote';
          console.error('❌ Quote failed:', errorMsg);
          setSwapError(errorMsg);
        }
      }
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      setSwapError(error instanceof Error ? error.message : 'Failed to get quote');
    } finally {
      setSwapLoading(false);
    }
  }, [account?.address, walletIdentity]);

  // Check if user has enough balance for the swap (runs alongside getSwapQuote)
  const checkSwapBalance = useCallback(async (metadata: Record<string, unknown>) => {
    setSwapInsufficientBalance(false);
    setSwapSellBalance(null);

    if (!client || !account?.address) return;

    const { amount, from_network, from_token } = metadata;
    if (!amount || !from_network || !from_token) return;

    const fromNetworkObj = getNetworkByName(from_network as string);
    if (!fromNetworkObj) return;

    const fromTokenObj = getTokenBySymbol(from_token as string, fromNetworkObj.chainId);
    if (!fromTokenObj) return;

    try {
      const { defineChain, getContract } = await import("thirdweb");
      const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");
      const { getBalance } = await import("thirdweb/extensions/erc20");

      const tokenAddress = fromTokenObj.address?.toLowerCase();
      const isNativeToken = !tokenAddress ||
        tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        tokenAddress === '0x0000000000000000000000000000000000000000' ||
        tokenAddress === 'native';

      let balance: bigint;
      let decimals = fromTokenObj.decimals || 18;

      if (isNativeToken) {
        const rpcRequest = getRpcClient({ client, chain: defineChain(fromNetworkObj.chainId) });
        balance = await eth_getBalance(rpcRequest, { address: account.address });
      } else {
        const tokenContract = getContract({
          client,
          chain: defineChain(fromNetworkObj.chainId),
          address: fromTokenObj.address,
        });
        const balanceResult = await getBalance({ contract: tokenContract, address: account.address });
        balance = balanceResult.value;
        decimals = balanceResult.decimals;
      }

      const formattedBalance = formatAmountHuman(balance, decimals, 6);
      setSwapSellBalance(formattedBalance);

      const userBalance = parseFloat(formattedBalance);
      const swapAmount = parseFloat(String(amount));
      setSwapInsufficientBalance(userBalance < swapAmount);
    } catch (error) {
      console.error('[Chat] Error checking swap balance:', error);
    }
  }, [client, account?.address]);

  return (
    <ProtectedRoute>
      <TransactionSettingsProvider>
        <>
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

          {/* Onboarding Modal - Shows when user has no balance after login */}
          <OnboardingModal />

          <SeniorAppShell pageTitle={activeConversationTitle}>
            <div className="flex flex-col h-full relative bg-black">
              {/* Ambient God Ray */}
              <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 via-slate-900/5 to-black blur-3xl pointer-events-none z-0" />

              <div className="flex-1 min-w-0 flex flex-col overflow-hidden z-10">
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
                  {initializing ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                      Loading your conversations...
                    </div>
                  ) : !activeConversationId && !pendingNewChat ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                      Create a new chat to get started.
                    </div>
                  ) : initializationError && !hasMessages && !pendingNewChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center min-h-[50vh]">
                      <p className="text-zinc-400">{initializationError}</p>
                      <button
                        onClick={retryBootstrap}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                      >
                        Try again
                      </button>
                    </div>
                  ) : isHistoryLoading && !hasMessages && !pendingNewChat ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 min-h-[50vh]">
                      Loading conversation...
                    </div>
                  ) : !hasMessages || pendingNewChat ? (
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

                        {/* Response Mode Toggle */}
                        <div className="flex items-center gap-1 mb-2 px-1 max-w-2xl mx-auto w-full">
                          <button
                            onClick={() => toggleResponseMode('fast')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                              responseMode === 'fast'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/5 text-zinc-500 border border-transparent hover:text-zinc-300'
                            )}
                          >
                            <Zap className="w-3 h-3" />
                            Fast
                          </button>
                          <button
                            onClick={() => toggleResponseMode('reasoning')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                              responseMode === 'reasoning'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-white/5 text-zinc-500 border border-transparent hover:text-zinc-300'
                            )}
                          >
                            <Brain className="w-3 h-3" />
                            Reasoning
                          </button>
                        </div>

                        {/* Main Input Area */}
                        <div className="relative group max-w-2xl mx-auto w-full my-4 overflow-hidden">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500 pointer-events-none" />
                          <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-1.5 md:gap-3 shadow-2xl transition-all duration-300 overflow-hidden">
                            {isRecording ? (
                              // Recording UI
                              <>
                                <button
                                  onClick={cancelRecording}
                                  className="p-2 md:p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                                  aria-label="Cancel recording"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-white font-mono text-xs md:text-sm">{formatRecordingTime(recordingTime)}</span>
                                  </div>
                                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                      initial={{ width: '0%' }}
                                      animate={{ width: `${Math.min((recordingTime / 60) * 100, 100)}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={transcribeAndDraft}
                                  disabled={isTranscribing}
                                  className="p-2.5 md:p-3 flex items-center justify-center bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 active:bg-cyan-200 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                                  aria-label="Transcribe audio"
                                >
                                  {isTranscribing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <ArrowUp className="w-5 h-5" />
                                  )}
                                </button>
                              </>
                            ) : isTranscribing ? (
                              // Transcribing UI
                              <>
                                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3 pl-3">
                                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                                  <span className="text-sm text-zinc-400">Transcribing...</span>
                                </div>
                                <button
                                  onClick={() => setIsTranscribing(false)}
                                  className="p-2 md:p-3 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
                                  aria-label="Cancel transcription"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              // Normal input UI
                              <>
                                <div className="pl-2 md:pl-4 text-zinc-400 shrink-0">
                                  <Search className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={inputMessage}
                                  onChange={(e) => setInputMessage(e.target.value)}
                                  onKeyPress={handleKeyPress}
                                  placeholder="Ask Zico anything..."
                                  disabled={isSending || (!activeConversationId && !pendingNewChat) || initializing}
                                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] text-white placeholder:text-zinc-600 min-h-[44px]"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={startRecording}
                                    disabled={isSending || (!activeConversationId && !pendingNewChat) || initializing}
                                    className="p-2 md:p-3 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label="Record audio"
                                  >
                                    <Mic className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => sendMessage()}
                                    disabled={isSending || (!activeConversationId && !pendingNewChat) || initializing || !inputMessage.trim()}
                                    className="p-2.5 md:p-3 flex items-center justify-center bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 active:bg-cyan-200 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label="Send message"
                                  >
                                    <ArrowUp className="w-5 h-5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {audioError && (
                            <p className="text-red-400 text-xs mt-2 text-center">{audioError}</p>
                          )}
                        </div>

                        {/* Suggestions Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 w-full md:w-auto mt-6">
                          {[
                            { label: 'Swap 0.1 ETH to USDC on Base', prompt: 'Swap 0.1 ETH to USDC on Base' },
                            { label: 'Swap 50 USDC to SOL on Solana', prompt: 'Swap 50 USDC to SOL on Solana' },
                            { label: 'What are the top trending tokens?', prompt: 'What are the top trending tokens today?' },
                            { label: 'Market analysis of Bitcoin', prompt: 'Give me a market analysis of Bitcoin' },
                          ].map((item) => (
                            <motion.button
                              key={item.label}
                              onClick={() => sendMessage(item.prompt)}
                              disabled={isSending || (!activeConversationId && !pendingNewChat)}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full text-left"
                            >
                              <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 min-h-[48px] flex items-center text-sm text-zinc-300 hover:text-white active:text-white hover:bg-white/10 active:bg-white/15 transition-colors">
                                {item.label}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col py-6">
                      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col gap-6">
                        {activeMessages.map((message, index) => (
                          <motion.div
                            key={`${message.role}-${index}`}
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
                                <div className="space-y-4 min-w-0 flex-1">
                                  <div className="text-zinc-100 text-base leading-relaxed">
                                    <MarkdownMessage text={message.content} />
                                  </div>

                                  {message.metadata?.event === 'swap_intent_ready' && (() => {
                                    const fromToken = String(message.metadata?.from_token || '');
                                    const toToken = String(message.metadata?.to_token || '');
                                    const fromNetwork = String(message.metadata?.from_network || '');
                                    const toNetwork = String(message.metadata?.to_network || '');
                                    const fromIcon = getTokenIcon(fromToken);
                                    const toIcon = getTokenIcon(toToken);
                                    const poweredBy = getSwapPoweredBy(fromNetwork, toNetwork);
                                    const toNetworkObj = getNetworkByName(toNetwork);
                                    const toTokenObj = toNetworkObj ? getTokenBySymbol(toToken, toNetworkObj.chainId) : null;
                                    const toDecimals = toTokenObj?.decimals ?? 18;

                                    return (
                                      <div className="mt-3 sm:mt-4 w-full max-w-[588px] sm:max-w-2xl">
                                        {/* Swap Card */}
                                        <div className="relative rounded-xl sm:rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                          {/* Gradient Glow */}
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-cyan-500/10 blur-[40px] pointer-events-none" />

                                          {/* Header */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 flex items-center gap-2">
                                            <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                            <span className="text-xs sm:text-sm font-semibold text-white">Swap</span>
                                            {isCrossChainSwap(fromNetwork, toNetwork) && (
                                              <span className="ml-auto px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] sm:text-[10px] font-medium rounded-full border border-purple-500/30">
                                                Cross-chain
                                              </span>
                                            )}
                                            {swapLoading && <div className="loader-inline-sm ml-auto" />}
                                          </div>

                                          {/* Content */}
                                          <div className="relative z-10 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                                            {/* From Token */}
                                            <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">Sell</span>
                                                <span className="text-[9px] sm:text-[10px] text-zinc-500">{fromNetwork}</span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg sm:text-xl font-medium text-white truncate">{String(message.metadata?.amount)}</span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                                  {fromIcon ? (
                                                    <img src={fromIcon} alt={fromToken} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                                  ) : (
                                                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold">
                                                      {fromToken[0]}
                                                    </div>
                                                  )}
                                                  <span className="text-xs sm:text-sm font-medium text-white">{fromToken}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="flex justify-center -my-0.5 sm:-my-1">
                                              <div className="bg-[#0A0A0A] border border-white/10 p-1 sm:p-1.5 rounded-lg">
                                                <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                                              </div>
                                            </div>

                                            {/* To Token */}
                                            <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">Buy</span>
                                                <span className="text-[9px] sm:text-[10px] text-zinc-500">{toNetwork}</span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg sm:text-xl font-medium text-white truncate">
                                                  {swapLoading ? '...' : swapQuote?.quote ? (
                                                    swapQuote.quote.sourceNetwork ?
                                                      toFixedFloor(Number(swapQuote.quote.estimatedReceiveAmount), 4) :
                                                      formatAmountHuman(BigInt(swapQuote.quote.toAmount || swapQuote.quote.estimatedReceiveAmount || 0), toDecimals)
                                                  ) : '~'}
                                                </span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                                  {toIcon ? (
                                                    <img src={toIcon} alt={toToken} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                                  ) : (
                                                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold">
                                                      {toToken[0]}
                                                    </div>
                                                  )}
                                                  <span className="text-xs sm:text-sm font-medium text-white">{toToken}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Error Message */}
                                            {swapError && !swapLoading && (
                                              <div className="p-2 sm:p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg sm:rounded-xl">
                                                <p className="text-[10px] sm:text-xs text-red-300">{swapError}</p>
                                              </div>
                                            )}

                                            {/* Insufficient Balance Warning */}
                                            {swapInsufficientBalance && !swapLoading && (
                                              <div className="bg-red-500/10 border border-red-500/40 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                                <div className="flex items-start gap-2">
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-400 flex-shrink-0 mt-0.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                  </svg>
                                                  <div>
                                                    <p className="text-xs font-semibold text-red-400 mb-0.5">Insufficient Balance</p>
                                                    <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-relaxed">
                                                      You have {swapSellBalance ?? '0'} {fromToken} but trying to swap {String(message.metadata?.amount)} {fromToken}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* Action Button */}
                                            <button
                                              onClick={async () => {
                                                const tokens = metadataToSwapTokens(message.metadata as Record<string, unknown>);
                                                if (tokens && tokens.from) {
                                                  // Auto-switch network before opening SwapWidget
                                                  await autoSwitchNetwork(tokens.from.network);
                                                  setSwapWidgetTokens({
                                                    ...tokens,
                                                    quote: swapQuote?.quote || null,
                                                    viewState: 'routing',
                                                  });
                                                  setShowSwapWidget(true);
                                                }
                                              }}
                                              disabled={swapLoading || !swapQuote?.quote}
                                              className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white text-black font-semibold text-xs sm:text-sm transition-all hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                            >
                                              {swapLoading ? 'Getting best price...' : 'Review Swap'}
                                            </button>
                                          </div>

                                          {/* Footer */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                            <img src={poweredBy.logo} alt={poweredBy.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-contain" />
                                            <span className="text-[9px] sm:text-[10px] text-zinc-500">Powered by {poweredBy.name}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {message.metadata?.event === 'lending_intent_ready' && (() => {
                                    const token = String(message.metadata?.token || 'USDC');
                                    const network = String(message.metadata?.network || 'Avalanche');
                                    const action = String(message.metadata?.action || 'Supply');
                                    const tokenIcon = getTokenIcon(token);

                                    return (
                                      <div className="mt-3 sm:mt-4 w-full max-w-[280px] sm:max-w-sm">
                                        {/* Lending Card */}
                                        <div className="relative rounded-xl sm:rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                          {/* Gradient Glow */}
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-emerald-500/10 blur-[40px] pointer-events-none" />

                                          {/* Header */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 flex items-center gap-2">
                                            <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                                            <span className="text-xs sm:text-sm font-semibold text-white">Lending</span>
                                            <span className="ml-auto px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] font-medium rounded-full border border-emerald-500/30">
                                              {action.toUpperCase()}
                                            </span>
                                          </div>

                                          {/* Content */}
                                          <div className="relative z-10 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                                            {/* Amount Card */}
                                            <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">Amount</span>
                                                <span className="text-[9px] sm:text-[10px] text-zinc-500">{network}</span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg sm:text-xl font-medium text-white truncate">
                                                  {String(message.metadata?.amount || '0')}
                                                </span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                                  {tokenIcon ? (
                                                    <img src={tokenIcon} alt={token} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                                  ) : (
                                                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold">
                                                      {token[0]}
                                                    </div>
                                                  )}
                                                  <span className="text-xs sm:text-sm font-medium text-white">{token}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Action Button */}
                                            <button
                                              onClick={async () => {
                                                // Auto-switch to Avalanche before opening lending modal
                                                await autoSwitchNetwork('avalanche');
                                                setCurrentLendingMetadata(message.metadata as Record<string, unknown>);
                                                setLendingModalOpen(true);
                                              }}
                                              className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white text-black font-semibold text-xs sm:text-sm transition-all hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                            >
                                              Review {action}
                                            </button>
                                          </div>

                                          {/* Footer */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                            <img src="/miniapp/icons/benqui_logo.png" alt="Benqi" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                            <span className="text-[9px] sm:text-[10px] text-zinc-500">Powered by Benqi</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {message.metadata?.event === 'staking_intent_ready' && (() => {
                                    const token = String(message.metadata?.token || 'ETH');
                                    const amount = Number(message.metadata?.amount || 0);
                                    const tokenIcon = getTokenIcon(token);
                                    const stTokenIcon = getTokenIcon(`st${token}`) || getTokenIcon('stETH');

                                    return (
                                      <div className="mt-3 sm:mt-4 w-full max-w-[280px] sm:max-w-sm">
                                        {/* Staking Card */}
                                        <div className="relative rounded-xl sm:rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                          {/* Gradient Glow */}
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-blue-500/10 blur-[40px] pointer-events-none" />

                                          {/* Header */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 flex items-center gap-2">
                                            <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                            <span className="text-xs sm:text-sm font-semibold text-white">Liquid Staking</span>
                                          </div>

                                          {/* Content */}
                                          <div className="relative z-10 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                                            {/* Stake Input */}
                                            <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">You Stake</span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg sm:text-xl font-medium text-white truncate">
                                                  {String(message.metadata?.amount || '0')}
                                                </span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                                  {tokenIcon ? (
                                                    <img src={tokenIcon} alt={token} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                                  ) : (
                                                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold">
                                                      {token[0]}
                                                    </div>
                                                  )}
                                                  <span className="text-xs sm:text-sm font-medium text-white">{token}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="flex justify-center -my-0.5 sm:-my-1">
                                              <div className="bg-[#0A0A0A] border border-white/10 p-1 sm:p-1.5 rounded-lg">
                                                <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                              </div>
                                            </div>

                                            {/* Receive Output */}
                                            <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">You Receive</span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-lg sm:text-xl font-medium text-white truncate">
                                                  ~{toFixedFloor(amount * 0.998, 4)}
                                                </span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                                  {stTokenIcon ? (
                                                    <img src={stTokenIcon} alt={`st${token}`} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                                  ) : (
                                                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-[7px] sm:text-[8px] text-white font-bold">
                                                      st
                                                    </div>
                                                  )}
                                                  <span className="text-xs sm:text-sm font-medium text-white">st{token}</span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Action Button */}
                                            <button
                                              onClick={async () => {
                                                // Auto-switch to Ethereum Mainnet before opening staking widget
                                                await autoSwitchNetwork('ethereum');
                                                setCurrentStakingMetadata(message.metadata as Record<string, unknown>);
                                                setShowStakingWidget(true);
                                              }}
                                              className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white text-black font-semibold text-xs sm:text-sm transition-all hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                            >
                                              Review Staking
                                            </button>
                                          </div>

                                          {/* Footer */}
                                          <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                            <img src="https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png" alt="Lido" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                            <span className="text-[9px] sm:text-[10px] text-zinc-500">Powered by Lido</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Copy button */}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.content).then(() => {
                                        setCopiedMessageIndex(index);
                                        setTimeout(() => setCopiedMessageIndex(null), 2000);
                                      });
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mt-1 w-fit"
                                  >
                                    {copiedMessageIndex === index ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-cyan-400">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}

                        {isSending && (
                          <div className="flex gap-4 max-w-[90%]">
                            <div className={cn(
                              "w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0 mt-1 overflow-hidden p-1",
                              !displayedTokens && "animate-pulse"
                            )}>
                              <Image src={zicoBlue} alt="Zico" width={24} height={24} className="w-full h-full object-contain drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Thought process steps */}
                              {isStreaming && streamThoughts.length > 0 && !displayedTokens && (
                                <ThoughtProcess thoughts={streamThoughts} isStreaming={isStreaming} />
                              )}

                              {/* Streaming tokens — typewriter effect */}
                              {displayedTokens ? (
                                <div className="space-y-2">
                                  {/* Collapsed thought steps */}
                                  {streamThoughts.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {streamThoughts.slice(-3).map((step) => (
                                        <span
                                          key={step.id}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-[10px] text-cyan-400/70 border border-cyan-500/10"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
                                          {step.label}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="text-zinc-100 text-base leading-relaxed">
                                    <MarkdownMessage text={autoFormatAssistantMarkdown(displayedTokens)} />
                                    {/* Block cursor on its own line while writing */}
                                    {(isStreaming || typewriterRevealing) && (
                                      <div className="mt-2">
                                        <span className="inline-block w-[3px] h-5 bg-cyan-400 rounded-[1px] animate-[cursor-blink_1s_step-end_infinite]" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Initial bounce dots when no thoughts yet */
                                !streamThoughts.length && (
                                  <div className="flex items-center gap-1 pt-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce" />
                                  </div>
                                )
                              )}

                              {activeMessages.at(-1)?.metadata?.event === 'staking_intent_ready' && (() => {
                                const token = String(activeMessages.at(-1)?.metadata?.token || 'ETH');
                                const amount = Number(activeMessages.at(-1)?.metadata?.amount || 0);
                                const tokenIcon = getTokenIcon(token);
                                const stTokenIcon = getTokenIcon(`st${token}`) || getTokenIcon('stETH');

                                return (
                                  <div className="mt-3 sm:mt-4 w-full max-w-[280px] sm:max-w-sm">
                                    {/* Staking Card */}
                                    <div className="relative rounded-xl sm:rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-xl">
                                      {/* Gradient Glow */}
                                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-16 bg-blue-500/10 blur-[40px] pointer-events-none" />

                                      {/* Header */}
                                      <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 flex items-center gap-2">
                                        <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                        <span className="text-xs sm:text-sm font-semibold text-white">Liquid Staking</span>
                                      </div>

                                      {/* Content */}
                                      <div className="relative z-10 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                                        {/* Stake Input */}
                                        <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">You Stake</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-lg sm:text-xl font-medium text-white truncate">
                                              {String(activeMessages.at(-1)?.metadata?.amount || '0')}
                                            </span>
                                            <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                              {tokenIcon ? (
                                                <img src={tokenIcon} alt={token} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                              ) : (
                                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold">
                                                  {token[0]}
                                                </div>
                                              )}
                                              <span className="text-xs sm:text-sm font-medium text-white">{token}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex justify-center -my-0.5 sm:-my-1">
                                          <div className="bg-[#0A0A0A] border border-white/10 p-1 sm:p-1.5 rounded-lg">
                                            <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                          </div>
                                        </div>

                                        {/* Receive Output */}
                                        <div className="bg-black/40 border border-white/5 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">You Receive</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-lg sm:text-xl font-medium text-white truncate">
                                              --
                                            </span>
                                            <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2 sm:px-2.5 py-1 shrink-0">
                                              {stTokenIcon ? (
                                                <img src={stTokenIcon} alt={`st${token}`} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                              ) : (
                                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-[7px] sm:text-[8px] text-white font-bold">
                                                  st
                                                </div>
                                              )}
                                              <span className="text-xs sm:text-sm font-medium text-white">st{token}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                          onClick={async () => {
                                            // Auto-switch to Ethereum Mainnet before opening staking widget
                                            await autoSwitchNetwork('ethereum');
                                            setCurrentStakingMetadata(activeMessages.at(-1)?.metadata as Record<string, unknown>);
                                            setShowStakingWidget(true);
                                          }}
                                          className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white text-black font-semibold text-xs sm:text-sm transition-all hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                        >
                                          Review Staking
                                        </button>
                                      </div>

                                      {/* Footer */}
                                      <div className="relative z-10 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-white/5 flex items-center justify-center gap-2">
                                        <img src="https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png" alt="Lido" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
                                        <span className="text-[9px] sm:text-[10px] text-zinc-500">Powered by Lido</span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                        {/* Keyboard spacer - ensures content is visible above keyboard */}
                        {isKeyboardOpen && <div style={{ height: keyboardHeight > 0 ? keyboardHeight : 0 }} />}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Bottom Input (Chat State) - OUTSIDE scrollable container */}
                <AnimatePresence>
                  {hasMessages && (
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="sticky bottom-0 px-4 md:px-8 pb-2 pt-3 bg-gradient-to-t from-black via-black/95 to-black/80 z-20 backdrop-blur-sm"
                    >
                      <div className="max-w-5xl mx-auto relative group">
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

                        {/* Response Mode Toggle */}
                        <div className="relative z-10 flex items-center gap-1 mb-1.5 px-1">
                          <button
                            onClick={() => toggleResponseMode('fast')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                              responseMode === 'fast'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/5 text-zinc-500 border border-transparent hover:text-zinc-300'
                            )}
                          >
                            <Zap className="w-3 h-3" />
                            Fast
                          </button>
                          <button
                            onClick={() => toggleResponseMode('reasoning')}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                              responseMode === 'reasoning'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-white/5 text-zinc-500 border border-transparent hover:text-zinc-300'
                            )}
                          >
                            <Brain className="w-3 h-3" />
                            Reasoning
                          </button>
                        </div>

                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500 pointer-events-none" />
                        <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 flex items-center gap-1.5 shadow-2xl overflow-hidden">
                          {isRecording ? (
                            // Recording UI
                            <>
                              <button
                                onClick={cancelRecording}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors shrink-0"
                                aria-label="Cancel recording"
                              >
                                <X className="w-5 h-5" />
                              </button>
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                  <span className="text-white font-mono text-xs">{formatRecordingTime(recordingTime)}</span>
                                </div>
                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${Math.min((recordingTime / 60) * 100, 100)}%` }}
                                    transition={{ duration: 0.5 }}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={transcribeAndDraft}
                                disabled={isTranscribing}
                                className="p-2.5 flex items-center justify-center bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 active:bg-cyan-200 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                                aria-label="Transcribe audio"
                              >
                                {isTranscribing ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <ArrowUp className="w-5 h-5" />
                                )}
                              </button>
                            </>
                          ) : isTranscribing ? (
                            // Transcribing UI
                            <>
                              <div className="flex-1 min-w-0 flex items-center gap-2 pl-2">
                                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                                <span className="text-sm text-zinc-400">Transcribing...</span>
                              </div>
                              <button
                                onClick={() => setIsTranscribing(false)}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
                                aria-label="Cancel transcription"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            // Normal input UI
                            <>
                              <button
                                onClick={() => setShowTrendingPrompts(!showTrendingPrompts)}
                                className="pl-1 text-zinc-400 hover:text-cyan-400 transition-colors shrink-0"
                                title="Trending prompts"
                              >
                                <Sparkles className="w-5 h-5" />
                              </button>
                              <input
                                ref={inputRef}
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                onFocus={() => setShowTrendingPrompts(false)}
                                placeholder="Send a message..."
                                disabled={isSending || !activeConversationId || initializing}
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[16px] text-white placeholder:text-zinc-600 min-h-[44px]"
                                autoFocus
                              />
                              <button
                                onClick={startRecording}
                                disabled={isSending || !activeConversationId || initializing}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                                aria-label="Record audio"
                              >
                                <Mic className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => sendMessage()}
                                disabled={isSending || !activeConversationId || initializing || !inputMessage.trim()}
                                className="p-2.5 flex items-center justify-center bg-cyan-400 text-black rounded-xl hover:bg-cyan-300 active:bg-cyan-200 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                                aria-label="Send message"
                              >
                                <ArrowUp className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                        {audioError && (
                          <p className="text-red-400 text-xs mt-2 text-center">{audioError}</p>
                        )}
                        <div className="text-center mt-2">
                          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">AI-Native Web3 Interface</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
	                initialAmount={
	                  typeof currentLendingMetadata?.amount === 'string' || typeof currentLendingMetadata?.amount === 'number'
	                    ? currentLendingMetadata.amount
	                    : undefined
	                }
	                initialAsset={
	                  (typeof currentLendingMetadata?.asset === 'string' ? currentLendingMetadata.asset : undefined) ||
	                  (typeof currentLendingMetadata?.token === 'string' ? currentLendingMetadata.token : undefined)
	                }
	                initialMode={
	                  parseLendingMode(currentLendingMetadata?.mode) ??
	                  deriveLendingModeFromAction(currentLendingMetadata?.action)
	                }
	                initialFlow={
	                  parseLendingFlow(currentLendingMetadata?.flow) ??
	                  deriveLendingFlowFromAction(currentLendingMetadata?.action)
	                }
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
                initialQuote={swapWidgetTokens.quote}
                initialViewState={swapWidgetTokens.viewState}
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
	                initialAmount={
	                  typeof currentStakingMetadata?.amount === 'string' || typeof currentStakingMetadata?.amount === 'number'
	                    ? currentStakingMetadata.amount
	                    : undefined
	                }
	                initialMode={
	                  parseStakingMode(currentStakingMetadata?.mode) ??
	                  parseStakingMode(currentStakingMetadata?.action)
	                }
	              />
	            )}
	          </AnimatePresence>
        </>
      </TransactionSettingsProvider>
    </ProtectedRoute>
  );
}

import type { Context, SessionFlavor } from 'grammy';
import type { HydrateFlavor } from '@grammyjs/hydrate';
import type { ConversationFlavor } from '@grammyjs/conversations';

export interface SessionData {
  // Identity
  smartAccountAddress?: string;
  sessionKeyAddress?: string;
  walletAddress?: string;
  zicoUserId?: string;
  jwtToken?: string;

  // Preferences
  defaultChainId: number;
  language: 'en' | 'pt';

  // State
  onboardingComplete: boolean;
  hasFundedAccount: boolean;

  // Wizard pre-fill data (from AI agent intent)
  wizardData?: Record<string, unknown>;

  // Last detected intent from AI agent (for callback routing)
  lastIntent?: {
    type: 'swap' | 'stake' | 'lend' | 'dca' | 'bridge';
    params: Record<string, unknown>;
    timestamp: number;
  };
}

export function defaultSession(): SessionData {
  return {
    defaultChainId: 8453,
    language: 'en',
    onboardingComplete: false,
    hasFundedAccount: false,
  };
}

type BaseContext = HydrateFlavor<Context & SessionFlavor<SessionData>>;

export type BotContext = ConversationFlavor<BaseContext>;

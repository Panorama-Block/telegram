import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewChatPage from '../page';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockLogout = vi.fn();
const mockIsTelegramWebApp = vi.fn(() => false);
const mockDetectTelegram = vi.fn(() => Promise.resolve(false));
const mockUseActiveAccount = vi.fn(() => undefined);
const mockUseActiveWallet = vi.fn(() => undefined);
const mockUseTonWallet = vi.fn(() => undefined);
const mockUseTonConnectUI = vi.fn(() => [{
  setConnectRequestParameters: vi.fn(),
  disconnect: vi.fn(),
  openModal: vi.fn(),
}]);
const mockAutoConnect = vi.fn(() => Promise.resolve(null));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />,
}));

vi.mock('thirdweb', () => ({
  createThirdwebClient: vi.fn(() => ({ clientId: 'test-client-id' })),
}));

vi.mock('@/shared/config/thirdweb', () => ({
  THIRDWEB_CLIENT_ID: 'test-client-id',
}));

vi.mock('thirdweb/auth', () => ({
  signLoginPayload: vi.fn(),
}));

vi.mock('thirdweb/wallets', () => ({
  inAppWallet: vi.fn(() => ({
    autoConnect: mockAutoConnect,
  })),
  createWallet: vi.fn(() => ({ id: 'io.metamask' })),
}));

vi.mock('thirdweb/react', () => ({
  ConnectButton: ({ connectButton }: { connectButton?: { label?: string } }) => (
    <button type="button">{connectButton?.label ?? 'Connect Wallet'}</button>
  ),
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => mockUseActiveWallet(),
}));

vi.mock('@tonconnect/ui-react', () => ({
  useTonWallet: () => mockUseTonWallet(),
  useTonConnectUI: () => mockUseTonConnectUI(),
}));

vi.mock('@/lib/isTelegram', () => ({
  isTelegramWebApp: () => mockIsTelegramWebApp(),
  detectTelegram: () => mockDetectTelegram(),
}));

vi.mock('@/shared/hooks/useLogout', () => ({
  useLogout: () => ({
    logout: mockLogout,
    isLoggingOut: false,
  }),
}));

vi.mock('@/shared/lib/authWalletBinding', () => ({
  clearAuthWalletBinding: vi.fn(),
  persistAuthWalletBinding: vi.fn(),
}));

vi.mock('@/shared/lib/telegram-link', () => ({
  linkTelegramIdentityIfAvailable: vi.fn(),
}));

describe('NewChatPage login options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTelegramWebApp.mockReturnValue(false);
    mockDetectTelegram.mockResolvedValue(false);
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWallet.mockReturnValue(undefined);
    mockUseTonWallet.mockReturnValue(undefined);
    mockAutoConnect.mockResolvedValue(null);
  });

  it('shows TON and thirdweb options inside Telegram', () => {
    mockIsTelegramWebApp.mockReturnValue(true);

    render(<NewChatPage />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Connect Wallet', 'Use TON Wallet']);
    expect(screen.getByRole('button', { name: 'Use TON Wallet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
  });

  it('keeps TON hidden outside Telegram and preserves web wallet login', () => {
    render(<NewChatPage />);

    expect(screen.queryByRole('button', { name: 'Use TON Wallet' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
  });

  it('opens the TON connect modal from the custom button', () => {
    const openModal = vi.fn();
    mockIsTelegramWebApp.mockReturnValue(true);
    mockUseTonConnectUI.mockReturnValue([{
      setConnectRequestParameters: vi.fn(),
      disconnect: vi.fn(),
      openModal,
    }]);

    render(<NewChatPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Use TON Wallet' }));

    expect(openModal).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ChatPage from '@/app/chat/page';
import { mockReplace } from '../../../../test/mocks/nextNavigation';

const searchParamsState = { value: '' };
const switchEthereumChainMock = vi.fn();

vi.mock('next/navigation', async () => {
  const { mockUsePathname, mockUseRouter, mockUseSearchParams } = await import('../../../../test/mocks/nextNavigation');
  return {
    useRouter: mockUseRouter,
    useSearchParams: () => mockUseSearchParams.mockImplementation(() => new URLSearchParams(searchParamsState.value))(),
    usePathname: () => mockUsePathname(),
  };
});

vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/layout', () => ({
  SeniorAppShell: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/Lending', () => ({
  Lending: () => <div data-testid="lending-modal">lending</div>,
}));

vi.mock('@/components/Staking', () => ({
  Staking: () => <div data-testid="staking-modal">staking</div>,
}));

vi.mock('@/components/SwapWidget', () => ({
  SwapWidget: () => null,
}));

vi.mock('@/components/OnboardingModal', () => ({
  OnboardingModal: () => null,
}));

vi.mock('@/clients/agentsClient', () => ({
  AgentsClient: class {
    async listConversations() {
      return ['conv_1'];
    }
    async fetchMessages() {
      return [];
    }
    async createConversation() {
      return 'conv_1';
    }
    async sendMessage() {
      return { content: 'ok' };
    }
  },
}));

vi.mock('@/shared/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    recordingTime: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    error: null,
  }),
}));

vi.mock('@/shared/hooks/useKeyboardHeight', () => ({
  useKeyboardHeight: () => ({ keyboardHeight: 0, isKeyboardOpen: false }),
}));

vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user_1' },
    isLoading: false,
  }),
}));

vi.mock('@/shared/hooks/useLogout', () => ({
  useLogout: () => ({ logout: vi.fn() }),
}));

vi.mock('thirdweb', () => ({
  createThirdwebClient: () => ({ id: 'client' }),
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
  useActiveWallet: () => ({ id: 'io.metamask' }),
}));

describe('ChatPage open-widget orchestration', () => {
  beforeEach(() => {
    searchParamsState.value = '';
    switchEthereumChainMock.mockReset();
    mockReplace.mockReset();

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        request: (args: { method: string }) => {
          if (args.method === 'eth_chainId') return Promise.resolve('0x1');
          if (args.method === 'wallet_switchEthereumChain') {
            switchEthereumChainMock(args);
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        },
      },
    });
  });

  test('auto-opens lending widget and clears query', async () => {
    searchParamsState.value = 'open=lending&amount=1&mode=supply&flow=open';
    render(<ChatPage />);

    expect(await screen.findByTestId('lending-modal')).toBeInTheDocument();

    await waitFor(() => {
      expect(switchEthereumChainMock).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/chat', { scroll: false });
    });
  });

  test('open query takes precedence and opens staking modal', async () => {
    searchParamsState.value = 'open=staking&new=true&amount=0.5&mode=stake';
    render(<ChatPage />);

    expect(await screen.findByTestId('staking-modal')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/chat', { scroll: false });
    });
  });
});

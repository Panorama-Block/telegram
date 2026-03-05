import { vi } from 'vitest';

export const mockSendTransaction = vi.fn();
export const mockSignMessage = vi.fn();
export const mockSwitchChain = vi.fn();

export const mockAccount = {
  address: '0x1111111111111111111111111111111111111111',
  sendTransaction: mockSendTransaction,
  signMessage: mockSignMessage,
};

export const mockWallet = {
  id: 'io.metamask',
};

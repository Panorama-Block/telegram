import { vi } from 'vitest';

export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockBack = vi.fn();

export const mockUseRouter = () => ({
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
});

export const mockUsePathname = vi.fn(() => '/chat');
export const mockUseSearchParams = vi.fn(() => new URLSearchParams());

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AppHeader from '@/components/navigation/AppHeader';
import { defaultNavigationItems } from '@/components/navigation/BottomNavigation';

vi.mock('next/image', () => ({
  default: (props: any) => {
    const { alt, ...rest } = props;
    return <img alt={alt ?? ''} {...rest} />;
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}));

vi.mock('@/shared/hooks/useLogout', () => ({
  useLogout: () => ({ logout: vi.fn(), isLoggingOut: false }),
}));

describe('Service navigation availability', () => {
  test('keeps lending and staking enabled in bottom navigation', () => {
    const lending = defaultNavigationItems.find((item) => item.key === 'lending');
    const staking = defaultNavigationItems.find((item) => item.key === 'staking');

    expect(lending).toBeDefined();
    expect(staking).toBeDefined();
    expect(lending?.disabled).not.toBe(true);
    expect(staking?.disabled).not.toBe(true);
    expect(lending?.href).toBe('/chat?open=lending');
    expect(staking?.href).toBe('/chat?open=staking');
  });

  test('does not render Soon badge for lending and staking in header', () => {
    render(<AppHeader showMenuButton={false} />);

    expect(screen.getByRole('button', { name: 'Lending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staking' })).toBeInTheDocument();
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });
});

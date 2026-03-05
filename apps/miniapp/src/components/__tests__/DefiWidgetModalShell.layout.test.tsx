import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';

vi.mock('framer-motion', async () => await import('../../../test/mocks/framerMotion'));

describe('DefiWidgetModalShell layout structure', () => {
  test('keeps a single scrollable container in modal mode', () => {
    render(
      <DefiWidgetModalShell onClose={vi.fn()} variant="modal">
        <div>Body content</div>
      </DefiWidgetModalShell>,
    );

    const overlay = screen.getByTestId('defi-widget-overlay');
    const card = screen.getByTestId('defi-widget-card');
    const body = screen.getByTestId('defi-widget-body');

    expect(overlay.className).not.toContain('overflow-y-auto');
    expect(card.className).not.toContain('overflow-y-auto');
    expect(body.className).toContain('overflow-y-auto');
  });
});

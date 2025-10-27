/**
 * ButtonShowcase - Demonstration of the new Button component
 * PanoramaBlock Design System v2.0
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

// Example icons (replace with any icon set you prefer)
const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export default function ButtonShowcase() {
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <div className="p-8 bg-pano-bg-primary min-h-screen">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-pano-text-primary font-display">
            PanoramaBlock Button Component
          </h1>
          <p className="text-pano-text-secondary text-lg">
            Showcase of the Button component with every variant and size option.
          </p>
        </div>

        {/* Variants */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Variants
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="success">Success</Button>
            <Button variant="link">Link</Button>
            <Button variant="glass">Glass</Button>
          </div>
        </section>

        {/* Sizes */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Sizes
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
          </div>
        </section>

        {/* Icons */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            With Icons
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button leftIcon={<DownloadIcon />}>
              Download
            </Button>
            <Button rightIcon={<ArrowRightIcon />} variant="secondary">
              Next Step
            </Button>
            <Button
              leftIcon={<HeartIcon />}
              rightIcon={<ArrowRightIcon />}
              variant="outline"
            >
              Like & Share
            </Button>
          </div>
        </section>

        {/* Icon Only */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Icon Only
          </h2>
          <div className="flex gap-4">
            <Button size="icon" variant="primary">
              <HeartIcon />
            </Button>
            <Button size="icon-sm" variant="secondary">
              <DownloadIcon />
            </Button>
            <Button size="icon-lg" variant="ghost">
              <ArrowRightIcon />
            </Button>
          </div>
        </section>

        {/* States */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            States
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              loading={loading}
              onClick={handleLoadingDemo}
            >
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
            <Button disabled>
              Disabled
            </Button>
            <Button variant="danger" disabled>
              Disabled Danger
            </Button>
          </div>
        </section>

        {/* Full Width */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Full Width
          </h2>
          <div className="space-y-4">
            <Button fullWidth variant="primary" size="lg">
              Full Width Primary Button
            </Button>
            <Button
              fullWidth
              variant="outline"
              leftIcon={<DownloadIcon />}
            >
              Full Width with Icon
            </Button>
          </div>
        </section>

        {/* Real World Examples */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Real World Examples
          </h2>
          <div className="bg-pano-surface rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium text-pano-text-primary">
              Authentication Flow
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<ArrowRightIcon />}
                fullWidth
              >
                Connect Wallet
              </Button>
              <Button
                variant="ghost"
                size="lg"
              >
                Learn More
              </Button>
            </div>
          </div>

          <div className="bg-pano-surface rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-medium text-pano-text-primary">
              Swap Interface
            </h3>
            <div className="space-y-3">
              <Button
                variant="primary"
                size="xl"
                fullWidth
                className="glow-primary-strong"
              >
                Start Swap
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">
                  Settings
                </Button>
                <Button variant="ghost" size="sm">
                  History
                </Button>
                <Button variant="outline" size="sm">
                  Help
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Design Tokens Demo */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-pano-text-primary border-b border-pano-border pb-2">
            Design System Integration
          </h2>
          <div className="bg-pano-surface rounded-lg p-6">
            <p className="text-pano-text-secondary mb-4">
              Every button here inherits colors and spacing from the PanoramaBlock Design System v2.0.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-pano-text-primary">Primary Color:</strong>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-4 h-4 bg-pano-primary rounded"></div>
                  <span className="text-pano-text-secondary font-mono">--pano-primary</span>
                </div>
              </div>
              <div>
                <strong className="text-pano-text-primary">Interactive Effects:</strong>
                <span className="text-pano-text-secondary ml-2">Hover, focus, scale animations</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

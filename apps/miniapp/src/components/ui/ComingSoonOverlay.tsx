'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { FEATURE_METADATA } from '@/config/features';

interface ComingSoonOverlayProps {
  /** Feature key to get metadata from config */
  featureKey: string;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Expected launch date */
  expectedLaunch?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ComingSoonOverlay Component
 *
 * Displays a full-screen overlay indicating that a feature is coming soon.
 * Used to block access to features that are still in development/testing.
 */
export function ComingSoonOverlay({
  featureKey,
  title,
  description,
  expectedLaunch,
  className,
}: ComingSoonOverlayProps) {
  const router = useRouter();
  const metadata = FEATURE_METADATA[featureKey];

  const displayTitle = title || metadata?.name || 'Coming Soon';
  const displayDescription = description || metadata?.description || 'This feature is currently under development.';
  const displayLaunch = expectedLaunch || metadata?.expectedLaunch;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4',
        'bg-black/90 backdrop-blur-md',
        className
      )}
    >
      <div className="max-w-[340px] w-full text-center">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-400 text-xs font-medium">Coming Soon</span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white mb-2">
          {displayTitle}
        </h1>

        {/* Description */}
        <p className="text-gray-400 text-xs leading-relaxed mb-3">
          {displayDescription}
        </p>

        {/* Expected Launch */}
        {displayLaunch && (
          <p className="text-zinc-500 text-[10px] mb-4">
            Expected: {displayLaunch}
          </p>
        )}

        {/* Action - Only Go to Chat */}
        <button
          onClick={() => router.push('/chat')}
          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-cyan-500/25"
        >
          Go to Chat
        </button>
      </div>
    </div>
  );
}

export default ComingSoonOverlay;

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { ComingSoonOverlay } from '@/components/ui/ComingSoonOverlay';
import { FEATURE_FLAGS } from '@/config/features';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Lending } from '@/components/Lending';

export default function LendingPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-[100dvh] bg-[#050606] text-pano-text-primary">
        {!FEATURE_FLAGS.LENDING_ENABLED && (
          <ComingSoonOverlay featureKey="lending" />
        )}
        <AnimatedBackground />
        <Lending variant="panel" onClose={() => router.back()} />
      </div>
    </ProtectedRoute>
  );
}

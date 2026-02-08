'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { ComingSoonOverlay } from '@/components/ui/ComingSoonOverlay';
import { FEATURE_FLAGS } from '@/config/features';
import { Staking } from '@/components/Staking';

export default function StakingPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#050606] text-pano-text-primary">
      {!FEATURE_FLAGS.STAKING_ENABLED && (
        <ComingSoonOverlay featureKey="staking" />
      )}
      <AnimatedBackground />
      <Staking variant="panel" onClose={() => router.back()} />
    </div>
  );
}

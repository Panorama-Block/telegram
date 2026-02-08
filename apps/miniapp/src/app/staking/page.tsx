'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Staking } from '@/components/Staking';

export default function StakingPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#050606] text-pano-text-primary">
      <Staking variant="panel" onClose={() => router.back()} />
    </div>
  );
}


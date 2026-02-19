'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lending } from '@/components/Lending';

export default function LendingPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-[#050606] text-pano-text-primary">
      <Lending variant="panel" onClose={() => router.back()} />
    </div>
  );
}


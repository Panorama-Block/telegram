'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect dashboard to chat with new conversation
    router.replace('/chat?new=true');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Redirecting...</div>
    </div>
  );
}

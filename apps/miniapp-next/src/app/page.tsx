'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionar para dashboard por padrão
    router.push('/dashboard');
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid #e0e0e0',
        borderTop: '3px solid #007aff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto'
      }} />
    </div>
  );
}

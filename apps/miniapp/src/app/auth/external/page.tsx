'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { authenticateWithRedirect } from 'thirdweb/wallets';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

export default function ExternalAuthPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Opening browser for authentication...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const clientId = THIRDWEB_CLIENT_ID;
        if (!clientId) throw new Error('THIRDWEB_CLIENT_ID missing');
        const client = createThirdwebClient({ clientId });
        const strategy = (search.get('strategy') || 'google') as any;
        const redirectUrl = `${window.location.origin}/miniapp/auth/callback`;

        setStatus('Redirecting to provider...');
        await authenticateWithRedirect({ client, strategy, mode: 'redirect', redirectUrl });
      } catch (e: any) {
        console.error('[EXTERNAL AUTH] error:', e);
        setError(e?.message || 'Authentication failed');
      }
    }
    run();
  }, [search, router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>External Authentication</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && (
          <p style={{ marginTop: 12, color: '#ef4444' }}>Error: {error}</p>
        )}
        {!error && (
          <p style={{ marginTop: 12, color: '#9ca3af', fontSize: 13 }}>
            If the provider window does not open automatically, copy the URL and open it in Safari.
          </p>
        )}
      </div>
    </div>
  );
}

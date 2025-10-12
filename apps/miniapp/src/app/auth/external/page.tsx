'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { authenticateWithRedirect } from 'thirdweb/wallets';

export default function ExternalAuthPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Abrindo navegador para autenticação...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
        if (!clientId) throw new Error('THIRDWEB_CLIENT_ID ausente');
        const client = createThirdwebClient({ clientId });
        const strategy = (search.get('strategy') || 'google') as any;
        const redirectUrl = `${window.location.origin}/miniapp/auth/callback`;

        setStatus('Redirecionando para o provedor...');
        await authenticateWithRedirect({ client, strategy, mode: 'redirect', redirectUrl });
      } catch (e: any) {
        console.error('[EXTERNAL AUTH] error:', e);
        setError(e?.message || 'Falha na autenticação');
      }
    }
    run();
  }, [search, router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Autenticação Externa</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && (
          <p style={{ marginTop: 12, color: '#ef4444' }}>Erro: {error}</p>
        )}
        {!error && (
          <p style={{ marginTop: 12, color: '#9ca3af', fontSize: 13 }}>
            Caso não abra automaticamente, copie a URL e abra no Safari.
          </p>
        )}
      </div>
    </div>
  );
}


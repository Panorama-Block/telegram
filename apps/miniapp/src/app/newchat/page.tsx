'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

export default function NewChatPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [status, setStatus] = useState('Preparando novo chat...');
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
    if (!clientId) return null;
    try {
      return createThirdwebClient({ clientId });
    } catch {
      return null;
    }
  }, []);

  // Garantir que a carteira está conectada (autoConnect)
  useEffect(() => {
    const run = async () => {
      try {
        const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
        if (!clientId) throw new Error('THIRDWEB_CLIENT_ID ausente');
        if (!client) throw new Error('Cliente thirdweb não inicializado');

        if (!account) {
          setStatus('Reconectando carteira...');
          const wallet = inAppWallet();
          await wallet.autoConnect({ client });
        }
      } catch (e: any) {
        console.error('[NEWCHAT] AutoConnect error:', e);
        setError(e?.message || 'Falha ao reconectar carteira');
      }
    };
    run();
  }, [account, client]);

  // Autenticar no backend se necessário e redirecionar para o chat
  useEffect(() => {
    const run = async () => {
      try {
        const existingToken = localStorage.getItem('authToken');
        if (existingToken) {
          router.replace('/chat');
          return;
        }
        if (!account) return;

        setStatus('Autenticando com backend...');
        const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
        if (!authApiBase) throw new Error('VITE_AUTH_API_BASE não configurado');
        const loginPayload = { address: account.address };
        const loginResponse = await fetch(`${authApiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });
        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          throw new Error(`Erro ao gerar payload: ${errorText}`);
        }
        const { payload } = await loginResponse.json();
        if (account.address.toLowerCase() !== payload.address.toLowerCase()) {
          throw new Error('Endereço retornado não confere com o payload');
        }

        let signature: string = '';
        try {
          const signResult = await signLoginPayload({ account, payload });
          if (typeof signResult === 'string') signature = signResult;
          else if (signResult && (signResult as any).signature) signature = (signResult as any).signature;
          else throw new Error('Formato de assinatura inválido');
        } catch (err) {
          console.error('[NEWCHAT] Erro assinatura', err);
          throw new Error('Falha ao assinar payload');
        }

        const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, signature }),
        });
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          throw new Error(`Erro na verificação: ${errorText}`);
        }
        const verifyResult = await verifyResponse.json();
        const { token: authToken } = verifyResult;
        if (!authToken) throw new Error('Token de autenticação ausente');

        localStorage.setItem('authToken', authToken);
        localStorage.setItem('authPayload', JSON.stringify(payload));
        localStorage.setItem('authSignature', signature);

        router.replace('/chat');
      } catch (e: any) {
        console.error('[NEWCHAT] Erro:', e);
        setError(e?.message || 'Falha na autenticação');
      }
    };
    run();
  }, [account, router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Criando novo chat</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{error ? `Erro: ${error}` : status}</p>
      </div>
    </div>
  );
}

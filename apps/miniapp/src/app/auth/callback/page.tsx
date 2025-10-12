'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { inAppWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

function decodeAuthResult(value: string) {
  try {
    // Some providers encode the JSON twice; try to decode safely
    const once = decodeURIComponent(value);
    const maybeJson = once.startsWith('{') ? once : decodeURIComponent(once);
    return JSON.parse(maybeJson);
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Inicializando...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        setStatus('Processando retorno de autenticação...');
        const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
        if (!clientId) {
          throw new Error('THIRDWEB_CLIENT_ID ausente');
        }

        // 1) Parse authResult (se presente) e persistir token localmente
        const url = new URL(window.location.href);
        const authResultParam = url.searchParams.get('authResult');
        if (!authResultParam) {
          // Sem authResult, seguimos tentando auto-conexão se já existir sessão local
          console.warn('[AUTH CALLBACK] Parametro authResult ausente');
        } else {
          const authResult = decodeAuthResult(authResultParam);
          if (!authResult || !authResult.storedToken || !authResult.storedToken.cookieString) {
            throw new Error('AuthResult inválido no retorno do OAuth');
          }
          const cookie = authResult.storedToken.cookieString as string;
          // Persistir para o storage esperado pelo SDK (walletToken-<clientId>)
          localStorage.setItem(`walletToken-${clientId}`, cookie);
          // Opcional: persistir userWalletId para futuras ações
          try {
            const userId = authResult?.storedToken?.authDetails?.userWalletId;
            if (userId) {
              localStorage.setItem(`thirdwebEwsWalletUserId-${clientId}`, userId);
            }
          } catch {}
        }

        // 2) Auto-conectar a wallet usando o token salvo
        setStatus('Conectando carteira...');
        const client = createThirdwebClient({ clientId });
        const wallet = inAppWallet();
        const account = await wallet.autoConnect({ client });

        if (!account) {
          throw new Error('Falha ao conectar a carteira após OAuth');
        }

        // 3) Autenticar no backend (gerar JWT da sua plataforma)
        setStatus('Autenticando com backend...');
        const authApiBase = process.env.VITE_AUTH_API_BASE || 'http://localhost:3001';

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
          console.error('[AUTH CALLBACK] Erro na assinatura do payload', err);
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
        if (!authToken) throw new Error('Token de autenticação ausente na resposta');

        // Persistir token da sua plataforma
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('authPayload', JSON.stringify(payload));
        localStorage.setItem('authSignature', signature);

        setStatus('Autenticação concluída. Redirecionando...');
        // 4) Redirecionar para nova conversa
        router.replace('/newchat');
      } catch (e: any) {
        console.error('[AUTH CALLBACK] Erro:', e);
        setError(e?.message || 'Falha na autenticação');
      }
    }

    run();
  }, [router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Finalizando login</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && (
          <p style={{ marginTop: 12, color: '#ef4444' }}>Erro: {error}</p>
        )}
      </div>
    </div>
  );
}


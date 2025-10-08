'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ConnectButton, useActiveAccount } from 'thirdweb/react'
import { createThirdwebClient } from 'thirdweb'
import { inAppWallet, createWallet } from 'thirdweb/wallets'
import { signLoginPayload } from 'thirdweb/auth'
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb'
import zicoBlue from '../../../../public/icons/zico_blue.svg'

const Hero = () => {
  const router = useRouter()
  const account = useActiveAccount()
  const [currentWord, setCurrentWord] = useState(0)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const words = [
    'Composable DeFi Strategies',
    'Real-Time AI Analytics',
    'Specialized Crypto Agents',
    'Cross-Chain AI Automation',
  ]

  const client = useMemo(() => {
    const clientId = THIRDWEB_CLIENT_ID || undefined;
    if (!clientId) {
      console.warn('No THIRDWEB_CLIENT_ID found')
      return null;
    }
    try {
      return createThirdwebClient({ clientId });
    } catch (err) {
      console.error('Failed to create thirdweb client', err);
      return null;
    }
  }, []);

  const wallets = useMemo(
    () => [
      inAppWallet({ auth: { options: ['google', 'telegram'] } }),
      createWallet('io.metamask'),
    ],
    [],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [words.length])

  // Auto-authenticate and redirect when wallet is connected
  useEffect(() => {
    if (account && client && !isAuthenticating) {
      authenticateWithBackend();
    }
  }, [account, client, isAuthenticating]);

  async function authenticateWithBackend() {
    if (!account || !client) {
      return;
    }

    const authApiBase = process.env.NEXT_PUBLIC_AUTH_API_BASE || 'http://localhost:3001';

    try {
      setIsAuthenticating(true);

      // 1. Get payload from backend
      const normalizedAddress = account.address;
      const loginPayload = { address: normalizedAddress };

      const loginResponse = await fetch(`${authApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro ao gerar payload');
      }

      const { payload } = await loginResponse.json();

      // 2. Sign payload using Thirdweb
      const signResult = await signLoginPayload({
        account: account,
        payload: payload
      });

      let signature;
      if (typeof signResult === 'string') {
        signature = signResult;
      } else if (signResult && signResult.signature) {
        signature = signResult.signature;
      } else {
        throw new Error('Formato de assinatura inválido');
      }

      // 3. Verify signature with backend
      const verifyPayload = { payload, signature };

      const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro na verificação');
      }

      const verifyResult = await verifyResponse.json();
      const { token: authToken } = verifyResult;

      // 4. Save auth data to localStorage
      localStorage.setItem('authPayload', JSON.stringify(payload));
      localStorage.setItem('authSignature', signature);
      localStorage.setItem('authToken', authToken);

      // 5. Redirect to chat with new chat parameter
      router.push('/chat?new=true');

    } catch (err: any) {
      console.error('Authentication failed:', err);
    } finally {
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-full mt-32">
      <h1 className="text-4xl lg:text-5xl 2xl:text-6xl text-landing-title w-[90%] md:w-full md:max-w-[1200px] mx-auto px-4 md:px-0">
        <span className="flex flex-col items-center gap-5 text-center">
          A Panoramic View of
          <span className="inline-block h-[1.2em]">
            <span key={words[currentWord]} className="inline-block animate-slideUpIn text-landing-highlight">
              {words[currentWord]}
            </span>
          </span>
          <div className="flex mx-auto w-fit h-8 mt-6" />
        </span>
      </h1>
      <span className="text-landing-text text-xl mx-auto text-center w-[90%] md:max-w-[600px] mt-4 lg:mt-0">
        Fusing multi-chain data pipelines with AI reasoning frameworks to empower decentralized, composable financial automation.
      </span>

      <div className="flex flex-col items-center mx-auto w-fit mt-8 gap-8 z-50">
        {client ? (
          <ConnectButton
            client={client}
            wallets={wallets}
            connectModal={{ size: 'compact' }}
            connectButton={{
              label: isAuthenticating ? 'Authenticating...' : 'Launch App',
              style: {
                minWidth: '180px',
                height: '56px',
                borderRadius: '30px',
                fontWeight: 600,
                fontSize: 16,
                background: isAuthenticating ? '#6b7280' : '#06b6d4',
                color: '#fff',
                border: 'none',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
              },
            }}
            theme="dark"
          />
        ) : (
          <div className="min-w-[180px] h-14 rounded-[30px] bg-gray-500 text-white flex items-center justify-center">
            Missing Config
          </div>
        )}

        {/* Zico Blue Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-400/20 blur-3xl rounded-full" />
          <Image
            src={zicoBlue}
            alt="Zico Blue"
            width={192}
            height={192}
            className="relative h-28 w-28 sm:h-32 sm:w-32 lg:h-40 lg:w-40"
          />
        </div>
      </div>
    </div>
  )
}

export default Hero

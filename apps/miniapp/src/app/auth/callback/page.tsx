'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../../public/icons/zico_blue.svg';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');

  useEffect(() => {
    const processAuthCallback = async () => {
      try {
        // Aguardar um momento para o Thirdweb processar o callback
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se há dados de autenticação no localStorage
        const authToken = localStorage.getItem('authToken');
        const authPayload = localStorage.getItem('authPayload');
        const authSignature = localStorage.getItem('authSignature');
        
        if (authToken && authPayload && authSignature) {
          setStatus('success');
          setMessage('Autenticação concluída com sucesso!');
          
          // Aguardar um momento e redirecionar para o chat
          setTimeout(() => {
            router.push('/chat');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Falha na autenticação. Tente novamente.');
          
          // Redirecionar para a página de auth após erro
          setTimeout(() => {
            router.push('/auth');
          }, 3000);
        }
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        setStatus('error');
        setMessage('Erro inesperado. Tente novamente.');
        
        setTimeout(() => {
          router.push('/auth');
        }, 3000);
      }
    };

    processAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Image
            src={zicoBlue}
            alt="Zico"
            width={80}
            height={80}
            className="w-20 h-20"
          />
        </div>
        
        <div className="mb-4">
          {status === 'processing' && (
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          )}
          {status === 'success' && (
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {status === 'error' && (
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mx-auto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
        
        <h2 className="text-xl font-semibold mb-2">
          {status === 'processing' && 'Processando...'}
          {status === 'success' && 'Sucesso!'}
          {status === 'error' && 'Erro'}
        </h2>
        
        <p className="text-gray-400 text-sm">
          {message}
        </p>
        
        {status === 'processing' && (
          <p className="text-gray-500 text-xs mt-4">
            Aguarde enquanto processamos sua autenticação...
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AgentsClient, ChatRequest, ChatResponse } from '../../clients/agentsClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  timestamp: Date;
  actions?: Array<{
    type: string;
    label: string;
    payload?: any;
  }>;
}

function pickReadableColor(theme: any): string {
  if (theme.isDark) {
    return '#ffffff';
  }
  return '#000000';
}

export default function ChatPage() {
  const theme = (window as any)?.Telegram?.WebApp?.themeParams;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentsClient = new AgentsClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mensagem de boas-vindas
    setMessages([{
      role: 'assistant',
      content: '👋 Olá! Sou o assistente IA do Panorama Block. Como posso ajudá-lo hoje?',
      agentName: 'assistant',
      timestamp: new Date()
    }]);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const userAddress = localStorage.getItem('userAddress') || '0x0000000000000000000000000000000000000000';

      const response = await agentsClient.chat({
        user_id: userAddress,
        conversation_id: conversationId,
        message: userMessage.content,
        chain_id: '1',
        wallet_address: userAddress,
        metadata: {
          channel: 'miniapp',
          chat_id: 0,
          telegram_user_id: 0
        }
      }, { jwt: authToken || undefined });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        agentName: 'assistant',
        timestamp: new Date(),
        actions: response.actions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        agentName: 'error',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAction = async (action: { type: string; label: string; payload?: any }) => {
    const actionMessage: Message = {
      role: 'user',
      content: `Executando ação: ${action.label}`,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, actionMessage]);
    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('authToken');
      const userAddress = localStorage.getItem('userAddress') || '0x0000000000000000000000000000000000000000';

      const response = await agentsClient.chat({
        user_id: userAddress,
        conversation_id: conversationId,
        message: `Execute action: ${action.type}`,
        chain_id: '1',
        wallet_address: userAddress,
        metadata: {
          channel: 'miniapp',
          chat_id: 0,
          telegram_user_id: 0
        }
      }, { jwt: authToken || undefined });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        agentName: 'assistant',
        timestamp: new Date(),
        actions: response.actions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '❌ Erro ao executar ação. Tente novamente.',
        agentName: 'error',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--tg-theme-bg-color, #ffffff)',
        color: pickReadableColor(theme),
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
          background: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          🤖 Chat IA
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tg-theme-hint-color, #687280)' }}>
          Assistente inteligente do Panorama Block
        </p>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '18px',
                background: message.role === 'user' 
                  ? 'var(--tg-theme-button-color, #007aff)'
                  : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                color: message.role === 'user' 
                  ? '#ffffff'
                  : pickReadableColor(theme),
                fontSize: 14,
                lineHeight: 1.4,
                wordWrap: 'break-word',
              }}
            >
              {message.agentName && message.agentName !== 'assistant' && (
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.7,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {message.agentName}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
              
              {/* Botões de ação */}
              {message.actions && message.actions.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {message.actions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      onClick={() => handleAction(action)}
                      disabled={isLoading}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--tg-theme-button-color, #007aff)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              
              <div
                style={{
                  fontSize: 10,
                  opacity: 0.6,
                  marginTop: '4px',
                  textAlign: 'right',
                }}
              >
                {message.timestamp.toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '18px',
                background: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                color: pickReadableColor(theme),
                fontSize: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid var(--tg-theme-hint-color, #ccc)',
                    borderTop: '2px solid var(--tg-theme-button-color, #007aff)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Pensando...
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
          background: 'var(--tg-theme-bg-color, #ffffff)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            style={{
              flex: 1,
              minHeight: '40px',
              maxHeight: '120px',
              padding: '12px',
              border: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
              borderRadius: '20px',
              background: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              color: pickReadableColor(theme),
              fontSize: 14,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: inputMessage.trim() && !isLoading
                ? 'var(--tg-theme-button-color, #007aff)'
                : 'var(--tg-theme-hint-color, #ccc)',
              color: '#ffffff',
              cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ➤
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

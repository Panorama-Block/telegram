'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SeniorAppShell } from '@/components/layout/SeniorAppShell';
import { AgentsClient } from '@/clients/agentsClient';
import { Button } from '@/components/ui/button';
import { Plus, MessageCircle, Clock } from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  updatedAt?: string;
}

function getWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('walletAddress');
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function HomePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = account?.address?.toLowerCase() || getWalletAddress();
  const agentsClient = new AgentsClient();

  useEffect(() => {
    const loadConversations = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const authToken = localStorage.getItem('authToken');
        const authOptions = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {};

        const response = await agentsClient.listConversations(userId, authOptions);

        if (response && Array.isArray(response)) {
          setConversations(response.slice(0, 10)); // Show latest 10 conversations
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [userId]);

  const handleNewChat = () => {
    router.push('/chat?new=true');
  };

  const handleContinueChat = (conversationId: string) => {
    router.push(`/chat?conversation_id=${conversationId}`);
  };

  return (
    <ProtectedRoute>
      <SeniorAppShell pageTitle="Zico AI Agent">
        <div className="flex flex-col h-full max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-4">
              Welcome to Zico AI Agent
            </h1>
            <p className="text-zinc-400 text-lg">
              Your AI-powered DeFi assistant for smart trading and insights
            </p>
          </div>

          {/* New Chat Button */}
          <div className="flex justify-center mb-8">
            <Button
              onClick={handleNewChat}
              className="bg-cyan-500 hover:bg-cyan-600 text-black px-8 py-3 rounded-xl font-medium flex items-center gap-3 text-lg transition-all transform hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Start New Chat
            </Button>
          </div>

          {/* Chat History */}
          <div className="bg-[#0b0d10]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Recent Conversations</h2>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                <p className="text-zinc-400 mt-4">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 text-lg mb-2">No conversations yet</p>
                <p className="text-zinc-500 text-sm">
                  Start your first chat to begin exploring DeFi with AI assistance
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleContinueChat(conversation.id)}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        <span className="text-white group-hover:text-cyan-100 font-medium truncate">
                          {conversation.title || `Conversation ${conversation.id.slice(0, 8)}`}
                        </span>
                      </div>
                      {conversation.updatedAt && (
                        <span className="text-zinc-500 text-sm">
                          {formatTimeAgo(conversation.updatedAt)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/portfolio')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all text-center group"
            >
              <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">Portfolio</h3>
              <p className="text-zinc-400 text-sm">View your assets</p>
            </button>

            <button
              onClick={() => router.push('/swap')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all text-center group"
            >
              <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">Swap</h3>
              <p className="text-zinc-400 text-sm">Exchange tokens</p>
            </button>

            <button
              onClick={() => router.push('/lending')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all text-center group"
            >
              <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">Lending</h3>
              <p className="text-zinc-400 text-sm">Supply & borrow</p>
            </button>
          </div>
        </div>
      </SeniorAppShell>
    </ProtectedRoute>
  );
}
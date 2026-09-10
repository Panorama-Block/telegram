'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SeniorAppShell } from '@/components/layout/SeniorAppShell';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  downloadAvaxAdminEvidenceExport,
  downloadAvaxEvidenceExport,
  getAvaxAdminEvidenceStatus,
} from '@/features/swap/avaxSwapApi';
import {
  collectVercelRuntimeEvidenceExport,
  downloadVercelRuntimeEvidenceExport,
} from '@/features/admin/vercelRuntimeEvidenceClient';
import {
  collectHuggingFaceRuntimeEvidenceExport,
  downloadHuggingFaceRuntimeEvidenceExport,
} from '@/features/admin/huggingFaceRuntimeEvidenceClient';

function getWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('walletAddress');
}

export default function HomePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [nickname, setNickname] = useState<string | null>(null);
  const [isEvidenceAdmin, setIsEvidenceAdmin] = useState(false);

  const userId = account?.address?.toLowerCase() || getWalletAddress();

  // Load nickname from localStorage (persisted by profile page)
  useEffect(() => {
    const stored = localStorage.getItem('profileNickname');
    if (stored) {
      setNickname(stored);
    } else if (userId) {
      // Try fetching from gateway
      import('@/features/gateway/profileApi').then(({ profileApi }) => {
        profileApi.getByWallet(userId).then((p) => {
          if (p?.nickname) {
            setNickname(p.nickname);
            localStorage.setItem('profileNickname', p.nickname);
          }
        }).catch(() => {});
      });
    }
  }, [userId]);
  useEffect(() => {
    let cancelled = false;

    setIsEvidenceAdmin(false);

    if (!account) {
      return () => {
        cancelled = true;
      };
    }

    const checkAdminCapability = async () => {
      try {
        const isAdmin = await getAvaxAdminEvidenceStatus(account);
        if (!cancelled) {
          setIsEvidenceAdmin(isAdmin);
        }
      } catch (error) {
        if (!cancelled) {
          setIsEvidenceAdmin(false);
        }
        console.error('Failed to verify Avalanche evidence admin capability:', error);
      }
    };

    void checkAdminCapability();

    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  const handleNewChat = () => {
    router.push('/chat?new=true');
  };

  const handleDownloadEvidence = async () => {
    if (!account) {
      alert('Connect your wallet first.');
      return;
    }

    try {
      const res = await downloadAvaxEvidenceExport(account);
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `panoramablock-avalanche-evidence-${account.address}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download Avalanche evidence:', error);
      alert(error instanceof Error ? error.message : 'Failed to download Avalanche evidence');
    }
  };


  const handleDownloadVercelInformation = async () => {
    if (!account) {
      alert('Connect your wallet first.');
      return;
    }

    if (!isEvidenceAdmin) {
      alert('Verified administrator capability is required.');
      return;
    }

    try {
      const evidence =
        await collectVercelRuntimeEvidenceExport(account);

      downloadVercelRuntimeEvidenceExport(evidence);
    } catch (error) {
      console.error(
        'Failed to download Vercel runtime evidence:',
        error
      );
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to download Vercel runtime evidence'
      );
    }
  };

  const handleDownloadHuggingFaceInformation = async () => {
    if (!account) {
      alert('Connect your wallet first.');
      return;
    }

    if (!isEvidenceAdmin) {
      alert('Verified administrator capability is required.');
      return;
    }

    try {
      const evidence =
        await collectHuggingFaceRuntimeEvidenceExport();

      downloadHuggingFaceRuntimeEvidenceExport(evidence);
    } catch (error) {
      console.error(
        'Failed to download Hugging Face runtime evidence:',
        error
      );
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to download Hugging Face runtime evidence'
      );
    }
  };

  const handleDownloadAdminEvidence = async () => {
    if (!account) {
      alert('Connect your wallet first.');
      return;
    }

    try {
      const res = await downloadAvaxAdminEvidenceExport(account);
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || 'panoramablock-avalanche-admin-evidence.json';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download admin Avalanche evidence:', error);
      alert(error instanceof Error ? error.message : 'Failed to download admin Avalanche evidence');
    }
  };


  return (
    <ProtectedRoute>
      <SeniorAppShell pageTitle="Zico AI Agent">
        <div className="flex flex-col h-full max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-4">
              {nickname ? `Welcome back, ${nickname}` : 'Welcome to Zico AI Agent'}
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
              onClick={() => router.push('/chat?open=lending')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all text-center group"
            >
              <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">Lending</h3>
              <p className="text-zinc-400 text-sm">Supply & borrow</p>
            </button>

            <button
              onClick={handleDownloadEvidence}
              disabled={!account}
              className="bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-xl p-4 transition-all text-center group"
            >
              <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">
                Download Evidence
              </h3>
              <p className="text-zinc-400 text-sm">Avalanche transaction proof</p>
            </button>

            {isEvidenceAdmin && (
              <>
                <button
                  onClick={handleDownloadAdminEvidence}
                  disabled={!account}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-xl p-4 transition-all text-center group"
                >
                  <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">
                    Admin Evidence Export
                  </h3>
                  <p className="text-zinc-400 text-sm">All Avalanche transaction proof</p>
                </button>

                <button
                  onClick={handleDownloadVercelInformation}
                  disabled={!account}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-xl p-4 transition-all text-center group"
                >
                  <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">
                    Download Vercel Information
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Redacted production runtime and environment evidence
                  </p>
                </button>

                <button
                  onClick={handleDownloadHuggingFaceInformation}
                  disabled={!account}
                  className="bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-xl p-4 transition-all text-center group"
                >
                  <h3 className="text-white group-hover:text-cyan-100 font-medium mb-2">
                    Download Hugging Face Information
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Redacted agent runtime and environment evidence
                  </p>
                </button>

              </>
            )}
          </div>

        </div>
      </SeniorAppShell>
    </ProtectedRoute>
  );
}

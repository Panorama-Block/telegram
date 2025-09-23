import { useEffect, useMemo, useState } from 'react';

import { verifyTelegramSession } from '../../shared/api/telegram';
import { useInitData } from '../../shared/hooks/useInitData';
import type { TelegramUser } from '../../shared/types/telegram';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useTelegramUser() {
  const initData = useInitData();
  const [status, setStatus] = useState<Status>('idle');
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus('loading');
        const data = await verifyTelegramSession(initData);
        if (!cancelled) {
          setUser(data);
          setStatus('ready');
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Erro desconhecido');
          setStatus('error');
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [initData]);

  return useMemo(() => ({
    initData,
    user,
    loading: status === 'loading' || status === 'idle',
    error,
  }), [error, initData, status, user]);
}

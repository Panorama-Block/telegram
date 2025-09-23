import { useMemo } from 'react';

export function useInitData(): string {
  return useMemo(() => {
    const fromTelegram = (window as any)?.Telegram?.WebApp?.initData as string | undefined;
    if (fromTelegram && fromTelegram.length > 0) {
      return fromTelegram;
    }
    const fromQuery = new URLSearchParams(window.location.search).get('initData');
    return fromQuery || '';
  }, []);
}

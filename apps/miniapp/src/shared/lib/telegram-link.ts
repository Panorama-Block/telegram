'use client';

interface LinkOptions {
  sessionId?: string | null;
  address?: string | null;
  source?: string;
}

function readStoredTelegramUserId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const fromStorage = localStorage.getItem('telegram_user');
    if (fromStorage) {
      const parsed = JSON.parse(fromStorage) as { id?: number | string };
      const value = parsed?.id;
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
  } catch {
    // ignore invalid storage payload
  }

  return null;
}

export async function getTelegramUserId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const fromStorage = readStoredTelegramUserId();
  if (fromStorage) return fromStorage;

  try {
    const WebApp = (await import('@twa-dev/sdk')).default;
    const value = WebApp?.initDataUnsafe?.user?.id;
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  } catch {
    // ignore non-telegram environments
  }

  return null;
}

export async function linkTelegramIdentityIfAvailable(
  authApiBase: string,
  zicoUserId: string | null | undefined,
  options: LinkOptions = {},
): Promise<boolean> {
  const base = (authApiBase || '').replace(/\/+$/, '');
  const zico = (zicoUserId || '').trim();
  console.info('[telegram-link] start', {
    hasAuthApiBase: Boolean(base),
    hasZicoUserId: Boolean(zico),
    source: options.source || null,
  });
  if (!base || !zico) {
    console.info('[telegram-link] skip:missing-input', {
      hasAuthApiBase: Boolean(base),
      hasZicoUserId: Boolean(zico),
      source: options.source || null,
    });
    return false;
  }

  const telegramUserId = await getTelegramUserId();
  if (!telegramUserId) {
    console.info('[telegram-link] skip:no-telegram-user-id', {
      source: options.source || null,
      hasStoredTelegramUser: typeof window !== 'undefined' ? Boolean(localStorage.getItem('telegram_user')) : false,
    });
    return false;
  }

  const payload: Record<string, unknown> = {
    telegram_user_id: telegramUserId,
    zico_user_id: zico,
  };
  if (options.sessionId) payload.session_id = options.sessionId;
  if (options.address) payload.address = options.address;
  if (options.source) payload.source = options.source;

  try {
    const response = await fetch(`${base}/auth/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[telegram-link] link request failed', { status: response.status, text });
      return false;
    }
    console.info('[telegram-link] link request success', {
      telegramUserId,
      zicoUserId: zico,
      source: options.source || null,
    });
    return true;
  } catch (error) {
    console.warn('[telegram-link] link request error', error);
    return false;
  }
}

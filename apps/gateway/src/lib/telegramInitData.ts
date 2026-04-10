import crypto from 'node:crypto';

/**
 * Verify a Telegram WebApp initData string and extract the user.
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed user info on success, or null if signature/auth_date invalid.
 */
export interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramInitDataUser;
  authDate: number;
  raw: URLSearchParams;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
): VerifiedInitData | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;

  // Build data_check_string: all params except hash, sorted by key, joined by \n
  const entries: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== 'hash') entries.push([key, value]);
  });
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const authDateStr = params.get('auth_date');
  const authDate = authDateStr ? Number(authDateStr) : 0;
  if (!authDate) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > maxAgeSeconds) return null;

  const userStr = params.get('user');
  if (!userStr) return null;

  let user: TelegramInitDataUser;
  try {
    user = JSON.parse(userStr);
  } catch {
    return null;
  }

  if (typeof user.id !== 'number') return null;

  return { user, authDate, raw: params };
}

import crypto from 'node:crypto';
import { z } from 'zod';

const InitDataBody = z.object({
  initData: z.string().min(1),
});

export type InitDataBody = z.infer<typeof InitDataBody>;

export const TelegramUserSchema = z.object({
  id: z.number(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export type TelegramUser = z.infer<typeof TelegramUserSchema>;

export interface ParsedInitData {
  dataCheckString: string;
  hash: string;
  authDate: number;
  user: TelegramUser;
}

export function validateInitDataBody(body: unknown): InitDataBody {
  return InitDataBody.parse(body);
}

export function parseInitDataString(initData: string): ParsedInitData {
  // Telegram envia querystring: key=value&key=value...
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('hash ausente');

  const authDateStr = params.get('auth_date');
  if (!authDateStr) throw new Error('auth_date ausente');
  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate)) throw new Error('auth_date inválido');

  // montar data_check_string com pares ordenados por chave, excluindo hash
  const pairs: string[] = [];
  const keys = Array.from(params.keys()).filter((k) => k !== 'hash').sort();
  for (const key of keys) {
    const value = params.get(key) ?? '';
    pairs.push(`${key}=${value}`);
  }
  const dataCheckString = pairs.join('\n');

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('user ausente');
  const userJson = decodeURIComponent(userRaw);
  const userParsed = JSON.parse(userJson);
  const user = TelegramUserSchema.parse(userParsed);

  return { dataCheckString, hash, authDate, user };
}

export function deriveSecretKey(botToken: string): Buffer {
  // secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function computeHmacHex(secretKey: Buffer, data: string): string {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}



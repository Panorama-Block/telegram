import { getInitData } from '../../shared/lib/initData';
import { verifyTelegramSession } from '../../shared/api/telegram';
import type { TelegramUser } from '../../shared/types/telegram';

export async function loadTelegramUser(): Promise<TelegramUser> {
  const initData = getInitData();
  return verifyTelegramSession(initData);
}

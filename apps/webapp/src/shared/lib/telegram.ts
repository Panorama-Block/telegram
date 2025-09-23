export function prepareTelegramWebApp() {
  const tg = (window as any)?.Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();
}

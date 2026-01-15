export function isTelegramWebApp(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).Telegram?.WebApp;
}

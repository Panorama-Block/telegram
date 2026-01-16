export function isTelegramWebApp(): boolean {
    if (typeof window === 'undefined') return false;
    const webApp = (window as any).Telegram?.WebApp;
    if (!webApp) return false;
    if (typeof webApp.initData === 'string' && webApp.initData.length > 0) return true;
    if (webApp.initDataUnsafe?.user) return true;
    return false;
}

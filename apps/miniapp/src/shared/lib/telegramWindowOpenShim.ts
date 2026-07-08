/**
 * Telegram Mini App window.open shim.
 *
 * Inside Telegram webviews, wallet deep links opened with window.open can fail or
 * leave the user on a spinner. This shim only installs in a real Telegram Mini App
 * context and only intercepts Telegram links plus known wallet deep links.
 * Generic HTTP(S) links must keep the browser popup behavior because OAuth providers
 * such as Google rely on receiving a real Window object from window.open().
 */

import { isTelegramWebApp } from '@/lib/isTelegram';

type TgWebApp = {
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  platform?: string;
};

const WALLET_SCHEMES = [
  "wc:",
  "metamask:",
  "https://metamask.app.link",
  "trust:",
  "https://link.trustwallet.com",
  "bitkeep:",
  "https://bkcode.vip",
  "https://bitkeep.jnj.mobi",
  "core:",
  "https://core.app",
  "rainbow:",
  "https://rnbwapp.com",
  "ledgerlive:",
];

function isWalletDeepLink(url: string): boolean {
  const lower = url.toLowerCase();
  return WALLET_SCHEMES.some((s) => lower.startsWith(s));
}

function getWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
}

let installed = false;

export function installTelegramWindowOpenShim(): void {
  if (installed) return;
  if (typeof window === "undefined") return;

  const webApp = getWebApp();
  if (!webApp || !isTelegramWebApp()) return;

  const originalOpen = window.open.bind(window);

  const withOriginalOpen = (fn: () => void): null => {
    const shimmedOpen = window.open;
    try {
      window.open = originalOpen;
      fn();
      return null;
    } finally {
      window.open = shimmedOpen;
    }
  };

  const callTelegramLinkOpener = (
    open: ((url: string, options?: { try_instant_view?: boolean }) => void) | undefined,
    href: string,
    target?: string,
    features?: string,
  ) => {
    if (!open) return originalOpen(href, target, features);
    return withOriginalOpen(() => open(href, { try_instant_view: false }));
  };

  const callTelegramInternalOpener = (href: string, target?: string, features?: string) => {
    if (!webApp.openTelegramLink) return originalOpen(href, target, features);
    return withOriginalOpen(() => webApp.openTelegramLink!(href));
  };

  (window as any).open = (
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null => {
    try {
      const href = typeof url === "string" ? url : url?.toString() ?? "";
      if (!href) return originalOpen(url as any, target, features);

      if (href.startsWith("tg://") || href.startsWith("https://t.me/")) {
        return callTelegramInternalOpener(href, target, features);
      }

      if (isWalletDeepLink(href)) {
        return callTelegramLinkOpener(webApp.openLink, href, target, features);
      }

      return originalOpen(url as any, target, features);
    } catch (err) {
      console.warn("[TgShim] window.open override failed:", err);
      return originalOpen(url as any, target, features);
    }
  };

  installed = true;
  console.log("[TgShim] window.open shim installed for Telegram webview");
}

/**
 * Telegram Mini App window.open shim.
 *
 * Inside Telegram webviews, wallet deep links opened with window.open can fail or
 * leave the user on a spinner. This shim only installs in a real Telegram Mini App
 * context and only intercepts Telegram links plus known wallet deep links.
 * Generic HTTP(S) links must keep the browser popup behavior because OAuth providers
 * such as Google rely on receiving a real Window object from window.open().
 */

type TgWebApp = {
  initData?: string;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  platform?: string;
  version?: string;
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

function hasRealTelegramMiniAppSignal(webApp: TgWebApp): boolean {
  if (typeof window === "undefined") return false;

  const initData = typeof webApp.initData === "string" ? webApp.initData.trim() : "";
  if (initData.length > 0) return true;

  const search = window.location?.search ?? "";
  const hasTgParams = /tgWebApp/i.test(search);
  const overrideParam = /(?:^|[?&])tma=(1|true)(?:&|$)/i.test(search);
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const hasTelegramUA = /Telegram/i.test(userAgent);
  const referrer = typeof document !== "undefined" ? document.referrer : "";
  const fromTelegramWeb = /web\.telegram\.(org|me)/i.test(referrer);
  const isIframe = window.top !== window;
  const host = window.location.hostname.toLowerCase();

  if (/^web\.telegram\.(org|me)$/i.test(host)) return true;
  if ((hasTgParams || overrideParam) && (hasTelegramUA || fromTelegramWeb || isIframe)) return true;
  if (isIframe && typeof webApp.version === "string" && (hasTelegramUA || fromTelegramWeb)) return true;

  return false;
}

let installed = false;

export function installTelegramWindowOpenShim(): void {
  if (installed) return;
  if (typeof window === "undefined") return;

  const webApp = getWebApp();
  if (!webApp || !hasRealTelegramMiniAppSignal(webApp)) return;

  const originalOpen = window.open.bind(window);

  const callTelegramLinkOpener = (open: ((url: string, options?: { try_instant_view?: boolean }) => void) | undefined, href: string) => {
    if (!open) return originalOpen(href, "_blank");

    const shimmedOpen = window.open;
    try {
      window.open = originalOpen;
      open(href, { try_instant_view: false });
      return null;
    } finally {
      window.open = shimmedOpen;
    }
  };

  const callTelegramInternalOpener = (href: string) => {
    if (!webApp.openTelegramLink) return originalOpen(href, "_blank");

    const shimmedOpen = window.open;
    try {
      window.open = originalOpen;
      webApp.openTelegramLink(href);
      return null;
    } finally {
      window.open = shimmedOpen;
    }
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
        return callTelegramInternalOpener(href);
      }

      if (isWalletDeepLink(href)) {
        return callTelegramLinkOpener(webApp.openLink, href);
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

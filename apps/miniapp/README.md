Panorama Block — Telegram Mini App

Deploy-ready Next.js (App Router) with thirdweb in-app wallet using OAuth redirect for Telegram WebView, and backend auth integration.

Quick Start (Local)

- Copy `.env.example` to `.env.local` and fill at least:
  - `THIRDWEB_CLIENT_ID`
  - `AUTH_API_BASE`
  - (Optional) `SWAP_API_BASE`, `PUBLIC_GATEWAY_URL`, `DEFAULT_CHAIN_ID` etc.
- Run `npm install` then `npm run dev`.
- Open http://localhost:3000/miniapp

Deploy (Vercel)

- Set these Project Env Vars in Vercel:
  - `THIRDWEB_CLIENT_ID`
  - `AUTH_API_BASE`
  - `TELEGRAM_BOT_USERNAME` (for deep link return from iOS external login)
  - (Optional) `SWAP_API_BASE`, `PUBLIC_GATEWAY_URL`, `DEFAULT_CHAIN_ID`, `AI_API_URL`, `AGENTS_*`
- Deploy the app. Production URL will be: `https://<your-vercel-domain>.vercel.app/miniapp`
- OAuth redirect is automatically configured to: `/miniapp/auth/callback`

Telegram Bot Setup

- In your bot, set the Web App URL to your production URL above (path `/miniapp`).
- The app detects Telegram WebView and uses OAuth via redirect, storing the in-app wallet token and auto-connecting on return.

Notes

- The TON Connect manifest is served dynamically at `/miniapp/api/tonconnect-manifest` and uses your deployment origin for icon/URL.
- After OAuth callback, the app redirects to `/miniapp/newchat`, then to `/miniapp/chat` once authenticated with the backend.

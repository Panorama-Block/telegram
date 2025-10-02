# Miniapp

Dev:

- Configure `VITE_GATEWAY_BASE` via variáveis de ambiente do Vite (ex.: http://localhost:8888)
- `npm run dev`

No Telegram, o `initData` é lido de `window.Telegram.WebApp.initData`. Para testar no navegador, passe `?initData=<query>` na URL.

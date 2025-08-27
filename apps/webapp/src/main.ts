declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
      };
    };
  }
}

async function verifyInitData(initData: string) {
  const base = import.meta.env.VITE_GATEWAY_BASE || '';
  const res = await fetch(`${base}/auth/telegram/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  return res.json();
}

async function main() {
  const app = document.getElementById('app');
  if (!app) return;

  const initData = window.Telegram?.WebApp?.initData || new URLSearchParams(location.search).get('initData') || '';
  app.innerHTML = `<p>Validando sessão...</p>`;
  try {
    const data = await verifyInitData(initData);
    app.innerHTML = `
      <div>
        <h3>Bem-vindo ao Zico</h3>
        <pre style="white-space: pre-wrap; word-break: break-word;">${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<p>Falha na verificação</p>`;
  }
}

main();



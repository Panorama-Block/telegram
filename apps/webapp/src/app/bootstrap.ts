import { loadTelegramUser } from '../features/auth/loadTelegramUser';
import { renderError, renderLoading, renderMain, renderStyles } from '../pages/home/templates';
import { bindFeatureButtons } from '../pages/home/events';
import { prepareTelegramWebApp } from '../shared/lib/telegram';

const STYLE_ID = 'zico-webapp-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = renderStyles();
  document.head.appendChild(style);
}

export async function bootstrapWebApp() {
  prepareTelegramWebApp();
  ensureStyles();

  const container = document.getElementById('app');
  if (!container) {
    console.error('#app container not found');
    return;
  }

  container.innerHTML = renderLoading();

  try {
    const user = await loadTelegramUser();
    container.innerHTML = renderMain(user);
    bindFeatureButtons();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    container.innerHTML = renderError(message);
  }
}

function popup(title: string, message: string) {
  const webapp = (window as any)?.Telegram?.WebApp;
  webapp?.showPopup?.({
    title,
    message,
    buttons: [{ type: 'ok', text: 'OK' }],
  });
}

export function bindFeatureButtons() {
  document.querySelectorAll<HTMLButtonElement>('.feature-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'chat':
          popup('💬 Chat com IA', 'Use o chat do Telegram para conversar diretamente com o Zico Agent!');
          break;
        case 'portfolio':
          popup('📊 Portfolio', 'Funcionalidade em desenvolvimento. Em breve você poderá ver seu portfolio aqui!');
          break;
        case 'settings':
          popup('⚙️ Configurações', 'Use o comando /settings no chat para acessar as configurações.');
          break;
        case 'help':
        default:
          popup('❓ Ajuda', 'Use o comando /help no chat para ver todos os comandos disponíveis.');
          break;
      }
    });
  });
}

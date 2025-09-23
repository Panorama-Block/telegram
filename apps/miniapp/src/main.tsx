import { bootstrapMiniApp } from './app/bootstrap';

void (async () => {
  const mounted = await bootstrapMiniApp();
  if (!mounted) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        void bootstrapMiniApp();
      },
      { once: true },
    );
  }
})();

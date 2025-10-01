import React from 'react';

import { DashboardPage } from '../pages/dashboard/Dashboard.page';
import { AuthPage } from '../pages/auth/AuthPage';
import { SwapPage } from '../pages/swap/SwapPage';

export function App() {
  // Determinar qual página mostrar baseado nos parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page') || 'dashboard';

  switch (page) {
    case 'auth':
      return <AuthPage />;
    case 'swap':
      return <SwapPage />;
    case 'dashboard':
    default:
      return <DashboardPage />;
  }
}

export default App;

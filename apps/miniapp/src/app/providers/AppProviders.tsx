import React from 'react';

interface TonConnectProviderProps {
  children: React.ReactNode;
  manifestUrl: string;
}

interface ThirdwebProviderProps {
  children: React.ReactNode;
  clientId?: string;
  activeChain?: unknown;
}

interface AppProvidersProps {
  children: React.ReactNode;
  manifestUrl: string;
  TonConnectUIProvider: React.ComponentType<TonConnectProviderProps>;
  thirdwebReact: any;
  thirdwebClientId: string;
}

export function AppProviders({
  children,
  manifestUrl,
  TonConnectUIProvider,
  thirdwebReact,
  thirdwebClientId,
}: AppProvidersProps) {
  const ThirdwebProvider: React.ComponentType<ThirdwebProviderProps> | undefined =
    thirdwebReact?.ThirdwebProvider;

  if (!ThirdwebProvider) {
    return <TonConnectUIProvider manifestUrl={manifestUrl}>{children}</TonConnectUIProvider>;
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <ThirdwebProvider clientId={thirdwebClientId} activeChain={undefined}>
        {children}
      </ThirdwebProvider>
    </TonConnectUIProvider>
  );
}

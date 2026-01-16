import React, { createContext, useContext, useMemo } from 'react';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { useActiveAccount } from 'thirdweb/react';
import { isTelegramWebApp } from '../../lib/isTelegram';

type ChainType = 'ton' | 'evm' | 'none';

export interface WalletIdentity {
    chainType: ChainType;
    address?: string | null;
    tonAddress?: string | null;
    tonAddressRaw?: string | null;
    evmAddress?: string | null;
    isTelegram: boolean;
    tonWallet?: any;
    evmAccount?: any;
}

const WalletIdentityContext = createContext<WalletIdentity>({
    chainType: 'none',
    isTelegram: false
});

export const useWalletIdentity = (): WalletIdentity => useContext(WalletIdentityContext);

interface Props {
    children: React.ReactNode;
}

export function WalletIdentityProvider({ children }: Props) {
    const tonAddress = useTonAddress();
    const tonAddressRaw = useTonAddress(false);
    const tonWallet = useTonWallet();
    const evmAccount = useActiveAccount();
    const isTelegram = isTelegramWebApp();

    const value = useMemo<WalletIdentity>(() => {
        if (isTelegram && tonWallet && tonAddress) {
            return {
                chainType: 'ton',
                address: tonAddress,
                tonAddress,
                tonAddressRaw,
                evmAddress: evmAccount?.address,
                isTelegram,
                tonWallet,
                evmAccount
            };
        }

        if (evmAccount?.address) {
            return {
                chainType: 'evm',
                address: evmAccount.address,
                tonAddress,
                tonAddressRaw,
                evmAddress: evmAccount.address,
                isTelegram,
                tonWallet,
                evmAccount
            };
        }

        return {
            chainType: 'none',
            address: undefined,
            tonAddress,
            tonAddressRaw,
            evmAddress: evmAccount?.address,
            isTelegram,
            tonWallet,
            evmAccount
        };
    }, [isTelegram, tonAddress, tonAddressRaw, tonWallet, evmAccount]);

    return (
        <WalletIdentityContext.Provider value={value}>
            {children}
        </WalletIdentityContext.Provider>
    );
}

import React, { ReactNode } from 'react';
import { SmartWalletClientType } from '@privy-io/js-sdk-core/smart-wallets';

declare const SmartWalletsProvider: ({ children }: {
    children: ReactNode;
}) => React.JSX.Element;
declare const useSmartWallets: () => {
    client: SmartWalletClientType | undefined;
    getClientForChain: ({ chainId }: GetClientForChainInput) => Promise<SmartWalletClientType>;
};
interface GetClientForChainInput {
    chainId: number;
}

export { SmartWalletsProvider, useSmartWallets };

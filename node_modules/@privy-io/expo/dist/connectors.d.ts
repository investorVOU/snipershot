import { Transaction, SendOptions } from '@solana/web3.js';

interface UseDeeplinkWalletConnectorProps {
    /**
     * The URL of your application that the wallet will display to the user
     * For example: "https://myapp.com"
     */
    appUrl: string;
    /**
     * The base URL of wallet you're deeplinking to.
     * For example: "https://phantom.app"
     */
    baseUrl: string;
    /**
     * The redirect path to be used when the wallet redirects back to your app.
     * For example: "/dashboard"
     *
     * @default "/"
     */
    redirectUri: string;
    /**
     * The name of the public key used for encryption.
     * For example: encryptionPublicKeyName
     */
    encryptionPublicKeyName: string;
    /**
     * Whether or not this hook should attempt to auto-reconnect on mount.
     *
     * @default true
     */
    autoReconnect?: boolean;
}
/**
 * New type without certain fields that are hardcoded for convenience.
 *
 * This is useful for when you want to use the generic wallet provider
 * to create a wallet provider for a specific wallet
 *
 * For example: Backpack or Phantom
 */
type UseSpecificWalletConnectorProps = Omit<UseDeeplinkWalletConnectorProps, 'baseUrl' | 'encryptionPublicKeyName'>;
/**
 * Response type for signing a message
 */
type SignMessageResponse = {
    /**
     * The signature produced by the wallet
     */
    signature: string;
};
/**
 * Response type for signing a transaction
 */
type SignTransactionResponse = {
    /**
     * The signature produced by the wallet
     */
    signature: string;
};
/**
 * Response type for signing and sending a transaction
 */
type SignAndSendTransactionResponse = {
    /**
     * The signature produced by the wallet
     */
    signature: string;
};
/**
 * Response type for signing transactions
 */
type SignAllTransactionResponse = {
    /**
     * The signatures produced by the wallet
     */
    transactions: string[];
};
/**
 * Return type for the seDeeplinkWalletConnector hook
 */
interface UseDeeplinkWalletConnector {
    /**
     * The public key (address) of the connected wallet
     */
    address: string | undefined;
    /**
     * Function to initiate connection to the wallet
     */
    connect: () => Promise<void>;
    /**
     * Function to request the wallet to sign a message
     * @param {string} message - The message to be signed
     */
    signMessage: (message: string) => Promise<SignMessageResponse>;
    /**
     * Function to request the wallet to sign a transaction
     * @param {Transaction} transaction - The transaction to be signed
     */
    signTransaction: (transaction: Transaction) => Promise<SignTransactionResponse>;
    /**
     * Function to request the wallet to sign and send a transaction
     * @param {Transaction} transaction - The transaction to be signed and sent
     * @param {SendOptions} [sendOptions] - Options for sending the transaction
     */
    signAndSendTransaction: (transaction: Transaction, sendOptions?: SendOptions) => Promise<SignAndSendTransactionResponse>;
    /**
     * Function to request the wallet to sign multiple transactions
     * @param {Transaction[]} transactions - Array of transactions to be signed
     */
    signAllTransactions: (transactions: Transaction[]) => Promise<SignAllTransactionResponse>;
    /**
     * Function to disconnect from the wallet
     */
    disconnect: () => Promise<void>;
    /**
     * Whether the wallet is currently connected
     */
    isConnected: boolean;
}
/**
 * Hook for connecting to and interacting with a generic blockchain wallet provider via deep linking.
 *
 * This hook handles wallet connection, signing messages, signing transactions, and managing
 * secure communication between the app and wallet through encrypted channels.
 *
 * @experimental
 *
 * @param {UseDeeplinkWalletConnectorProps} props - Configuration properties for the wallet provider
 * @returns {UseDeeplinkWalletConnector} An object containing wallet connection state and methods for interaction
 * @returns {string|undefined} address - The connected wallet's public key, if connected
 * @returns {Function} connect - Function to initiate connection to the wallet
 * @returns {Function} signMessage - Function to request the wallet to sign a message
 * @returns {Function} signTransaction - Function to request the wallet to sign a transaction
 * @returns {Function} signAndSendTransaction - Function to request the wallet to sign and send a transaction
 * @returns {Function} signAllTransactions - Function to request the wallet to sign multiple transactions
 * @returns {Function} disconnect - Function to disconnect from the wallet
 * @returns {boolean} isConnected - Whether the wallet is currently connected
 */
declare const useDeeplinkWalletConnector: ({ baseUrl, appUrl, redirectUri, autoReconnect, encryptionPublicKeyName, }: UseDeeplinkWalletConnectorProps) => UseDeeplinkWalletConnector;

/**
 * A custom React hook for integrating with the Phantom wallet provider.
 *
 * This hook is a specialized wrapper around the more generic `useDeeplinkWalletConnector` hook,
 * pre-configured with Phantom-specific settings. It automatically sets the appropriate
 * base URL and encryption public key name required for Phantom wallet integration.
 *
 * @experimental
 *
 * @param {UseSpecificWalletConnectorProps} props - Configuration options for the wallet provider
 * @returns The wallet provider interface from useDeeplinkWalletConnector with Phantom-specific configuration
 *
 * @remarks
 * This hook hardcodes two Phantom-specific values:
 * - baseUrl: "https://phantom.app" - The base URL for Phantom deep links
 *   (from https://docs.phantom.com/phantom-deeplinks/provider-methods/connect#base-url)
 * - encryptionPublicKeyName: "phantom_encryption_public_key" - The public key name used during connection approval
 *   (from https://docs.phantom.com/phantom-deeplinks/provider-methods/connect#approve)
 *
 * @example
 * const { connect, disconnect, isConnected, publicKey } = usePhantomDeeplinkWalletConnector({
 *  appUrl: "https://myapp.com",
 *  redirectUri: "myapp:///"
 * });
 */
declare const usePhantomDeeplinkWalletConnector: (props: UseSpecificWalletConnectorProps) => UseDeeplinkWalletConnector;

/**
 * A custom React hook for integrating with the Backpack wallet provider.
 *
 * This hook is a specialized wrapper around the more generic `useDeeplinkWalletConnector` hook,
 * pre-configured with Backpack-specific settings. It automatically sets the appropriate
 * base URL and encryption public key name required for Backpack wallet integration.
 *
 * @experimental
 *
 * @param {UseSpecificWalletConnectorProps} props - Configuration options for the wallet provider
 * @returns The wallet provider interface from useDeeplinkWalletConnector with Backpack-specific configuration
 *
 * @remarks
 * This hook hardcodes two Backpack-specific values:
 * - baseUrl: "https://backpack.app" - The base URL for Backpack deep links
 *   (from https://docs.backpack.app/deeplinks/provider-methods/connect#base-url)
 * - encryptionPublicKeyName: "wallet_xxx" - The public key name used during connection approval
 *   (from https://docs.backpack.app/deeplinks/provider-methods/connect#approve)
 *
 * @example
 * const { connect, disconnect, isConnected, publicKey } = useBackpackDeeplinkWalletConnector({
 *   appUrl: "https://myapp.com",
 *   redirectUri: "myapp:///"
 * });
 */
declare const useBackpackDeeplinkWalletConnector: (props: UseSpecificWalletConnectorProps) => UseDeeplinkWalletConnector;

export { SignAllTransactionResponse, SignAndSendTransactionResponse, SignMessageResponse, SignTransactionResponse, UseDeeplinkWalletConnector, UseDeeplinkWalletConnectorProps, UseSpecificWalletConnectorProps, useBackpackDeeplinkWalletConnector, useDeeplinkWalletConnector, usePhantomDeeplinkWalletConnector };

import React from 'react';
import { ExternalOAuthProviderID, User } from '@privy-io/api-types';
import { MfaMethod, Chain, SolanaCluster } from '@privy-io/js-sdk-core';

type ColorScheme = 'light' | 'dark';
type ColorLiteral = `#${string}`;
interface ElementsAppearanceConfig {
    colorScheme?: ColorScheme;
    accentColor?: ColorLiteral;
}

type PrivyElementsConfig = {
    appearance?: ElementsAppearanceConfig;
    passkeys?: {
        /**
         * - If `true`, unenrolling a passkey from MFA will also remove it as a login method.
         * - If `false`, it will keep it as a login method as long as it has not been manually unlinked.
         *
         * @default true
         */
        shouldUnlinkOnUnenrollMfa?: boolean;
    };
    mfa?: {
        /**
         * Enables MFA verification via Privy-managed UIs, handled automatically prompting the user when an mfa-requiring operation is called.
         *
         * Avoid using the `useRegisterMfaListener` hook if you have this option enabled, to avoid
         * duplicating MFA verification UIs.
         *
         * @default false
         */
        enableMfaVerificationUIs?: boolean;
    };
};
interface PrivyElementsProps {
    config?: PrivyElementsConfig;
}
/**
 * The component that renders all UI powered by Privy.
 *
 * This is a modal component that needs to be mounted in order to invoke any UI
 * related functionality.
 */
declare const PrivyElements: ({ config }: PrivyElementsProps) => React.JSX.Element;

type LoginMethod = 'email' | 'sms' | ExternalOAuthProviderID;
type LoginUIConfig = {
    loginMethods: Array<LoginMethod>;
    appearance?: {
        /**
         * Logo for the main Privy Elements screen.
         * This must the the `url` to an image. The aspect ratio is 2:1.
         */
        logo?: string;
    };
};

type ClientUIErrorCode = 'ui_flow_timeout' | 'ui_flow_closed' | 'existing_ui_flow_in_progress' | 'existing_wallet_sign_flow_in_progress' | 'wallet_sign_flow_timeout' | 'wallet_sign_flow_closed' | 'wallet_sign_while_not_connected' | 'underlying_error' | 'user_already_logged_in' | 'no_login_methods_available' | 'login_flow_timeout' | 'login_flow_closed' | 'existing_login_flow_in_progress' | 'privy_elements_not_ready' | 'privy_not_ready' | 'unsupported_login_method' | 'funding_flow_cancelled' | 'chain_not_supported' | 'asset_not_supported' | 'asset_info_not_found' | 'failed_to_fetch_funding_provider_uri' | 'provider_transaction_failed' | 'amount_not_specified';
declare class PrivyUIError extends Error {
    error: string;
    code: ClientUIErrorCode;
    constructor(code: ClientUIErrorCode, error: string);
}

interface LoginResult {
    user: User;
}
interface UseLoginInterface {
    /**
     * An async method to trigger the Privy-managed login flow.
     *
     * @param config The configuration for the login flow.
     * @returns A promise that resolves with the result of the login flow.
     * @throws The promise is rejected with an error of type PrivyUIError.
     */
    login: (config: LoginUIConfig) => Promise<LoginResult>;
}
/**
 * A hook to trigger a login flow with Privy-powered UI.
 * The `login` method returned by it is async and resolved with the result of
 * the login flow.
 *
 * Depends on `PrivyElements` being mounted in the component tree.
 *
 * @returns An object with a `login` method to trigger the login flow.
 */
declare const useLogin: () => UseLoginInterface;

interface WalletUIAppearance {
    /**
     * Title for the Sign Message screen.
     * Defaults to 'Sign message'.
     */
    title: string;
    /**
     * Description text for the Sign Message screen.
     * Defaults to 'Sign to continue'.
     */
    description: string;
    /**
     * Text for the CTA button on the Sign Message screen.
     * Defaults to 'Confirm signature'.
     */
    buttonText: string;
    /**
     * An icon to display on the Sign Message screen. The aspect ratio is 1:1.
     */
    logo?: string;
}
interface SignMessageParams {
    message: string | Uint8Array;
    appearance?: Partial<WalletUIAppearance>;
}
interface SignMessageResult {
    signature: string;
}
interface UseSignMessageInterface {
    /**
     * Use this method to prompt the user to sign a message with their embedded wallet.
     * @param config - The configuration for the sign message prompt.
     * @param config.message - The message to sign.
     * @param config.appearance - Visual configuration for the sign message prompt.
     * @returns A Promise of the resulting signature.
     */
    signMessage: (config: SignMessageParams) => Promise<SignMessageResult>;
}
/**
 * Use this hook to sign a message using the embedded wallet, using the default UI powered by PrivyElements.
 *
 * @returns signMessage - prompts the user to sign a message with their embedded wallet, returning a Promise of the
 * resulting signature.
 */
declare const useSignMessage: () => UseSignMessageInterface;

interface SolanaSignMessageParams extends SignMessageParams {
    /**
     * The address of the wallet to sign the message with.
     */
    address?: string;
}
interface UseSolanaSignMessageInterface {
    /**
     * Use this method to prompt the user to sign a message with their embedded Solana wallet.
     * @param config - The configuration for the sign message prompt.
     * @param config.message - The message to sign.
     * @param config.address - The address of the wallet to sign the message with.
     * @param config.appearance - Visual configuration for the sign message prompt.
     * @returns A Promise of the resulting signature.
     */
    signMessage: (config: SolanaSignMessageParams) => Promise<SignMessageResult>;
}
/**
 * Use this hook to sign a message using the embedded wallet, using the default UI powered by PrivyElements.
 *
 * @returns signMessage - prompts the user to sign a message with their embedded wallet, returning a Promise of the
 * resulting signature.
 */
declare const useSolanaSignMessage: () => UseSolanaSignMessageInterface;

interface UseDelegatedActionsInterface {
    /**
     * Prompts the user to delegate access to their wallet to allow an app to transact on behalf of a
     * user within a set of pre-defined permissions. Users can always decline or revoke delegation.
     *
     * @param address {string} address of the wallet to delegate
     * @param chainType {'solana' | 'ethereum'} chain type for the wallet to delegate
     */
    delegateWallet: ({ address, chainType, }: {
        address: string;
        chainType: 'solana' | 'ethereum';
    }) => Promise<{
        user: User;
    }>;
    /**
     * Revokes the wallet API's ability to transact with a user's delegated wallets. This will revoke
     * ALL wallets that have been delegated by the user, in case the user has delegated multiple
     * embedded wallets.
     *
     * @returns Promise that resolves if the revocation was successful, with the updated user object, and errors otherwise
     */
    revokeWallets: () => Promise<{
        user: User;
    }>;
}
/**
 * A hook to prompt the user for permission to execute certain transactions to the wallet API, with
 * Privy-powered UI. Controls both the consent and revoke flows.
 *
 * Depends on `PrivyElements` being mounted in the component tree.
 *
 * @returns an object with the `delegateWallet` and `revokeWallets` methods.
 */
declare const useDelegatedActions: () => UseDelegatedActionsInterface;

interface UseMfaEnrollmentUIInterface {
    /**
     * Starts the MFA enrollment flow
     * @param mfaMethods
     * @param relyingParty
     */
    init: (params: {
        mfaMethods: MfaMethod[];
        relyingParty?: string;
    }) => Promise<void>;
}
declare function useMfaEnrollmentUI(): {
    init: (params: {
        mfaMethods: MfaMethod[];
        relyingParty?: string;
    }) => Promise<void>;
};

/**
 * Asset type.
 */
type FundingAsset = {
    tokenAddress: string;
} | 'USDC' | 'native-currency';
/**
 * Configuration object to fund a wallet.
 */
type BaseFundingConfig = {
    /**
     * Address of the wallet to fund
     */
    address: string;
    /**
     * Asset to fund. Defaults to the app's configured asset.
     */
    asset?: FundingAsset;
    /**
     * Amount to fund with. Defaults to the app's configured amount.
     */
    amount?: string;
    /**
     * Configuration for Moonpay
     */
    moonpay?: {
        /**
         * The payment method to use
         */
        useSandbox?: boolean;
        /**
         * Configuration for Moonpay UIs
         */
        uiConfig?: {
            /**
             * The accent color of the UI in Hex value
             */
            accentColor?: string;
            /**
             * The theme of the UI, light or dark
             */
            theme?: 'light' | 'dark';
        };
    };
};
/**
 * Config for preferred credit card provider. We will default to using this method first if available.
 */
type PreferredCardProvider = 'coinbase' | 'moonpay';
/**
 * Configuration object to fund a wallet.
 */
type FundingConfig = BaseFundingConfig & {
    /**
     * Chain on which to fund the wallet. Defaults to the app's configured chain.
     */
    chain?: Chain;
    defaultPaymentMethod?: 'card' | 'exchange';
    card?: {
        /** The preferred card onramp for funding */
        preferredProvider?: PreferredCardProvider;
    };
};
type FundingSolanaConfig = BaseFundingConfig & {
    /**
     * Asset to fund. Defaults to the app's configured asset.
     */
    asset?: 'USDC' | 'native-currency';
    /**
     * The Solana cluster to fund on. Defaults to mainnet-beta
     */
    cluster?: SolanaCluster;
    defaultPaymentMethod?: 'card' | 'exchange';
    card?: {
        /** The preferred card onramp for funding */
        preferredProvider?: PreferredCardProvider;
    };
};

/**
 * Method to fund a user's wallet via Privy's funding feature by inputting a valid wallet address.
 * You can access the fields and methods documented here via the {@link useFundWallet} hook.
 */
type UseFundWallet = {
    /**
     * Prompt the user to go through the funding flow and for a specified wallet.
     *
     * This will open the modal with a prompt for the user to select a funding method (if multiple are enabled).
     *
     * Once the user continues to the funding flow, Privy will display the funding status screen, and wait
     * for the transaction to complete.
     *
     * Note: Even after a successful funding, funds can take a few minutes to arrive in the user's wallet.
     *
     * @param address {string} Wallet address to fund
     * @param config {@link FundingConfig} Funding configuration to specify address, chain and asset
     */
    fundWallet: (config: FundingConfig) => Promise<void>;
};
declare function useFundWallet(): {
    fundWallet: (config: FundingConfig) => Promise<void>;
};

/**
 * Method to fund a user's wallet via Privy's funding feature by inputting a valid wallet address.
 * You can access the fields and methods documented here via the {@link useFundSolanaWallet} hook.
 */
type UseFundSolanaWallet = {
    /**
     * Prompt the user to go through the funding flow and for a specified wallet.
     *
     * This will open the modal with a prompt for the user to select a funding method (if multiple are enabled).
     *
     * Once the user continues to the funding flow, Privy will display the funding status screen, and wait
     * for the transaction to complete.
     *
     * Note: Even after a successful funding, funds can take a few minutes to arrive in the user's wallet.
     *
     * @param address {string} Wallet address to fund
     * @param config {@link FundingSolanaConfig} Funding configuration to specify address, cluster and asset
     */
    fundWallet: (config: FundingSolanaConfig) => Promise<void>;
};
declare function useFundSolanaWallet(): {
    fundWallet: (config: FundingSolanaConfig) => Promise<void>;
};

export { FundingAsset, FundingConfig, FundingSolanaConfig, LoginUIConfig, PrivyElements, PrivyUIError, UseDelegatedActionsInterface, UseFundSolanaWallet, UseFundWallet, UseLoginInterface, UseMfaEnrollmentUIInterface, UseSignMessageInterface, UseSolanaSignMessageInterface, useDelegatedActions, useFundSolanaWallet, useFundWallet, useLogin, useMfaEnrollmentUI, useSignMessage, useSolanaSignMessage };

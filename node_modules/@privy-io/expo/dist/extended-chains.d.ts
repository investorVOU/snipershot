import { CurveSigningChainType, User, Wallet } from '@privy-io/api-types';

interface CreateWalletInput {
    /** The chain type of the wallet to create. */
    chainType: CurveSigningChainType | 'spark';
}
interface CreateWalletOutput {
    user: User;
    wallet: Wallet;
}
interface UseCreateWalletInterface {
    /**
     * Create a new wallet for the user, on an extended chain.
     */
    createWallet: (input: CreateWalletInput) => Promise<CreateWalletOutput>;
}
declare const useCreateWallet: () => UseCreateWalletInterface;

interface SignRawHashInput {
    /** The address of the wallet to sign the hash with. */
    address: string;
    /** The chain type of the wallet to sign the hash with. */
    chainType: CurveSigningChainType;
    /** The hash to sign. */
    hash: `0x${string}`;
}
interface SignRawHashOutput {
    /** The signature of the hash. */
    signature: `0x${string}`;
}
interface UseSignRawHashInterface {
    /**
     * Sign a raw hash with a wallet along the blockchain's cryptographic curve.
     * This is only supported for extended chains.
     */
    signRawHash: (input: SignRawHashInput) => Promise<SignRawHashOutput>;
}
declare const useSignRawHash: () => UseSignRawHashInterface;

export { useCreateWallet, useSignRawHash };

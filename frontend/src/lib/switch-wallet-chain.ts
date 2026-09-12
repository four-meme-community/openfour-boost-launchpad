/**
 * Ask a connected wallet to switch to the selected app chain.
 * Skip when disconnected; the connector adds the chain if missing.
 */
import { getAccount, switchChain } from "wagmi/actions";
import { wagmiConfig } from "./wagmi";

type ConfiguredChainId = (typeof wagmiConfig)["chains"][number]["id"];

function isConfiguredChainId(chainId: number): chainId is ConfiguredChainId {
	return wagmiConfig.chains.some((chain) => chain.id === chainId);
}

export async function switchWalletToChain(chainId: number) {
	if (!isConfiguredChainId(chainId)) return;
	const account = getAccount(wagmiConfig);
	if (!account.isConnected) return;
	if (account.chainId === chainId) return;
	await switchChain(wagmiConfig, { chainId });
}

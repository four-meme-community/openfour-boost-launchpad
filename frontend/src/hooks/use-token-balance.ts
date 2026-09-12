/**
 * Explicit native / ERC20 balance on the target chain (same as meme-launcher getTokenBalance).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { getBalance, readContract } from "wagmi/actions";
import { erc20Abi, formatUnits, isAddress, type Address } from "viem";
import { getActiveChain } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

export function useNativeBalance(
	address?: Address,
	refetchInterval = 6_000,
) {
	return useQuery({
		queryKey: ["balance", "native", address, getActiveChain().id],
		enabled: !!address && isAddress(address),
		refetchInterval,
		retry: 2,
		queryFn: async () => {
			const bal = await getBalance(wagmiConfig, {
				address: address as Address,
				chainId: getActiveChain().id,
			});
			return bal;
		},
	});
}

export function useErc20Balance(
	owner?: Address,
	token?: Address | null,
	refetchInterval = 6_000,
) {
	return useQuery({
		queryKey: ["balance", "erc20", owner, token, getActiveChain().id],
		enabled:
			!!owner &&
			isAddress(owner) &&
			!!token &&
			isAddress(token) &&
			token !== "0x0000000000000000000000000000000000000000",
		refetchInterval,
		retry: 2,
		queryFn: async () => {
			const chainId = getActiveChain().id;
			const [value, decimals] = await Promise.all([
				readContract(wagmiConfig, {
					address: token as Address,
					abi: erc20Abi,
					functionName: "balanceOf",
					args: [owner as Address],
					chainId,
				}),
				readContract(wagmiConfig, {
					address: token as Address,
					abi: erc20Abi,
					functionName: "decimals",
					chainId,
				}).catch(() => 18),
			]);
			return { value, decimals: Number(decimals) };
		},
	});
}

export function formatBalanceWei(
	value?: bigint | null,
	decimals = 18,
	dp = 6,
): string {
	if (value == null) return "0";
	const raw = formatUnits(value, decimals);
	const [i, f = ""] = raw.split(".");
	if (!f || dp <= 0) return i;
	const trimmed = f.slice(0, dp).replace(/0+$/, "");
	return trimmed ? `${i}.${trimmed}` : i;
}

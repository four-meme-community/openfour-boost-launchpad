/**
 * Token template identity via `descriptor()`.
 *
 * All six OpenFour token templates (TaxToken / Stock4TaxToken / StrategyTaxToken /
 * CreatorRewardsToken / UniToken / base OpenFourToken) share one base class and
 * this read-only selector — call it on any deployed address without knowing the
 * template first:
 *
 *   function descriptor() external view
 *     returns (bytes8 tagId, string memory tag, string memory version)
 *
 * `tag` values (verified on live BSC mainnet RPC):
 * - "token.tax"            TaxToken
 * - "token.tax.stock"      Stock4TaxToken (same tax ABI as TaxToken)
 * - "token.strategy_tax"    StrategyTaxToken (splits on separate taxStrategy)
 * - "token.creator_rewards" CreatorRewardsToken (creator/protocol split, not burn/LP/dividend)
 * - "token.uni"             UniToken (no tax)
 * - "token.standard"        base OpenFourToken (no tax)
 *
 * Same ABI fragment as migration-module detection in `lib/zap-route.ts`.
 */
import { readContract } from "wagmi/actions";
import type { Address } from "viem";
import { getActiveChain } from "./chain";
import { wagmiConfig } from "./wagmi";

export const TAG_DESCRIPTOR_ABI = [
	{
		type: "function",
		name: "descriptor",
		stateMutability: "view",
		inputs: [],
		outputs: [
			{ name: "tagId", type: "bytes8" },
			{ name: "tag", type: "string" },
			{ name: "version", type: "string" },
		],
	},
] as const;

export type TokenDescriptor = {
	tag: string;
	version: string;
};

/** On failure (old tokens without the fn, bad address, etc.) return null — do not throw. */
export async function readTokenDescriptor(
	address: Address,
): Promise<TokenDescriptor | null> {
	try {
		const [, tag, version] = await readContract(wagmiConfig, {
			address,
			abi: TAG_DESCRIPTOR_ABI,
			functionName: "descriptor",
			chainId: getActiveChain().id,
		});
		return { tag, version };
	} catch {
		return null;
	}
}

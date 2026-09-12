/**
 * BFF public config client (SSR-safe).
 */
import { publicEnv } from "./env";
import {
	fallbackPublicChains,
	type PublicChain,
} from "./chain-config";

export type { PublicChain };

export type SiteConfig = {
	name: string;
	tagline: string;
	logoUrl: string | null;
	primaryColor: string;
	chains: PublicChain[];
	defaultChain: string;
};

export const FALLBACK_SITE_CONFIG: SiteConfig = {
	name: "OpenFour Boost",
	tagline: "Launch on your brand",
	logoUrl: null,
	primaryColor: "#111111",
	...fallbackPublicChains(),
};

export async function fetchSiteConfig(): Promise<SiteConfig> {
	const res = await fetch(`${publicEnv.bffUrl}/v1/config`, {
		cache: "no-store",
	});
	if (!res.ok) throw new Error(`config ${res.status}`);
	const json = (await res.json()) as { ok: boolean; data: SiteConfig };
	if (!json.ok) throw new Error("config not ok");
	const data = json.data;
	const fallback = fallbackPublicChains();
	const chains =
		Array.isArray(data.chains) && data.chains.length > 0
			? data.chains.map((chain) => ({
					...chain,
					presetIds: Array.isArray(chain.presetIds)
						? chain.presetIds.map(String).filter(Boolean)
						: [],
				}))
			: fallback.chains;
	return {
		name: data.name,
		tagline: data.tagline,
		logoUrl: data.logoUrl,
		primaryColor: data.primaryColor,
		chains,
		defaultChain: data.defaultChain || fallback.defaultChain,
	};
}

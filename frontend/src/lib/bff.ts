/**
 * BFF public config client (SSR-safe).
 */
import { publicEnv } from "./env";

export type SiteConfig = {
	name: string;
	tagline: string;
	logoUrl: string | null;
	primaryColor: string;
};

export async function fetchSiteConfig(): Promise<SiteConfig> {
	const res = await fetch(`${publicEnv.bffUrl}/v1/config`, {
		cache: "no-store",
	});
	if (!res.ok) throw new Error(`config ${res.status}`);
	const json = (await res.json()) as { ok: boolean; data: SiteConfig };
	if (!json.ok) throw new Error("config not ok");
	return json.data;
}

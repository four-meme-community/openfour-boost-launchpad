/**
 * Per-chain OpenFour create preset IDs.
 *
 * Env `CREATE_PRESETS` maps catalog or family keys to id lists.
 *
 * Format: `key:id,id;key:id`
 * Example:
 *   CREATE_PRESETS=bsc-testnet:1778027615722,1778027615733;robinhood-testnet:1778027615741,1778027615742
 *
 * Lookup order for a chain: catalog `key` first, then family `id`.
 * BSC testnet: 5722 standard bonding (proven createArg), 5733 tax.
 * Robin testnet: 5741 standard, 5742 tax.
 */
export const DEFAULT_CREATE_PRESETS =
	"bsc:1778027615733;bsc-testnet:1778027615722,1778027615733;robinhood:1778027615741,1778027615742;robinhood-testnet:1778027615741,1778027615742";

export function parseCreatePresetMap(raw: string): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	const groups = raw
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean);

	for (const group of groups) {
		const colon = group.indexOf(":");
		if (colon <= 0) {
			throw new Error(
				`Invalid CREATE_PRESETS entry "${group}". Use key:id,id`,
			);
		}
		const key = group.slice(0, colon).trim().toLowerCase();
		if (!key) {
			throw new Error(`Invalid CREATE_PRESETS chain key in "${group}"`);
		}
		const ids: string[] = [];
		const seen = new Set<string>();
		for (const idRaw of group
			.slice(colon + 1)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)) {
			if (!/^\d+$/.test(idRaw)) {
				throw new Error(`Invalid create preset id "${idRaw}"`);
			}
			if (seen.has(idRaw)) continue;
			seen.add(idRaw);
			ids.push(idRaw);
		}
		out[key] = ids;
	}

	return out;
}

export function presetIdsForChain(
	map: Record<string, string[]>,
	chain: { key: string; id: string },
): string[] {
	return map[chain.key] || map[chain.id] || [];
}

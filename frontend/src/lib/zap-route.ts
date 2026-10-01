/**
 * ZapRouter route parsing (aligned with meme-launcher `util/dex.js`).
 */
import { readContract } from "wagmi/actions";
import { isAddress, zeroAddress, type Address, type Hex } from "viem";
import { getActiveChain } from "./chain";
import { wagmiConfig } from "./wagmi";
import { WBNB } from "./dex-v2";
import { TAG_DESCRIPTOR_ABI } from "./token-descriptor";

export const ZAP_DEX_ID = {
	PANCAKE_V2: 1,
	PANCAKE_V3: 2,
	LISTA_V2: 3,
	LISTA_V3: 4,
} as const;

export const ZAP_DEX_TYPE = {
	V2: 1,
	V3: 2,
} as const;

export const PANCAKE_V2_MIGRATE_MODULE_TAG = "module.migrate.pcs_v2";
export const LISTA_V2_MIGRATE_MODULE_TAG = "module.migrate.bonding_lista_v2";

export type ZapRoute = {
	dexId: number;
	dexType: number;
	bridgeToken: Address;
	fee: number;
};

export type TokenZapMeta = {
	zapRoute?: {
		dexId?: number;
		dexType?: number;
		bridgeToken?: string;
		fee?: number;
	};
	dexRoute?: {
		dexId?: number;
		dexType?: number;
		bridgeToken?: string;
		fee?: number;
	};
	zapDexId?: number;
	zapDexType?: number;
	zapBridgeToken?: string;
	zapPoolFee?: number;
	poolFee?: number;
	fee?: number;
	dexType?: string | number;
	dexPair?: { fee?: number };
	migrateModuleTag?: string;
	migrateTag?: string;
};

const TOKEN_MIGRATE_MODULE_ABI = [
	{
		type: "function",
		name: "migrateModule",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "address" }],
	},
] as const;

function normalizeDexType(dexType?: string | number | null) {
	return String(dexType || "")
		.trim()
		.toUpperCase();
}

function readExplicitZapRoute(
	tokenData?: TokenZapMeta | null,
): Omit<ZapRoute, "bridgeToken"> & { bridgeToken: string } | null {
	const route = tokenData?.zapRoute || tokenData?.dexRoute;
	const dexId = Number(route?.dexId ?? tokenData?.zapDexId);
	if (!Number.isInteger(dexId) || dexId <= 0 || dexId > 255) return null;
	const configuredDexType = Number(
		route?.dexType ?? tokenData?.zapDexType ?? 0,
	);
	const inferredDexType = [ZAP_DEX_ID.PANCAKE_V2, ZAP_DEX_ID.LISTA_V2].includes(
		dexId as 1 | 3,
	)
		? ZAP_DEX_TYPE.V2
		: [ZAP_DEX_ID.PANCAKE_V3, ZAP_DEX_ID.LISTA_V3].includes(dexId as 2 | 4)
			? ZAP_DEX_TYPE.V3
			: 0;
	const dexType = configuredDexType || inferredDexType;
	if (dexType !== ZAP_DEX_TYPE.V2 && dexType !== ZAP_DEX_TYPE.V3) return null;
	return {
		dexId,
		dexType,
		bridgeToken: route?.bridgeToken || tokenData?.zapBridgeToken || "",
		fee: Number(route?.fee ?? tokenData?.zapPoolFee ?? 0),
	};
}

/** Parse Zap ViaBridge last/first hop params */
export function resolveZapDexRoute(params: {
	tokenData?: TokenZapMeta | null;
	dexType?: string | number | null;
	migrateModuleTag?: string;
	wrappedNative?: Address | null;
	quoteAsset?: Address | null;
}): ZapRoute | null {
	const {
		tokenData,
		dexType,
		migrateModuleTag = "",
		wrappedNative,
		quoteAsset,
	} = params;
	const bridgeFallback = (quoteAsset || wrappedNative || WBNB) as Address;

	const explicit = readExplicitZapRoute(tokenData);
	if (explicit) {
		const bridge = (explicit.bridgeToken || bridgeFallback) as Address;
		if (!isAddress(bridge) || bridge === zeroAddress) return null;
		return { ...explicit, bridgeToken: bridge };
	}

	const normalized = normalizeDexType(dexType ?? tokenData?.dexType);
	if (
		normalized === "LISTA_V2" ||
		normalized === "LISTA_SWAP_V2" ||
		migrateModuleTag === LISTA_V2_MIGRATE_MODULE_TAG
	) {
		return {
			dexId: ZAP_DEX_ID.LISTA_V2,
			dexType: ZAP_DEX_TYPE.V2,
			bridgeToken: bridgeFallback,
			fee: 0,
		};
	}
	if (normalized === "LISTA_V3" || normalized === "LISTA_SWAP_V3") {
		const fee = Number(
			tokenData?.poolFee || tokenData?.dexPair?.fee || tokenData?.fee || 0,
		);
		return fee > 0
			? {
					dexId: ZAP_DEX_ID.LISTA_V3,
					dexType: ZAP_DEX_TYPE.V3,
					bridgeToken: bridgeFallback,
					fee,
				}
			: null;
	}
	if (normalized === "PANCAKE_SWAP_V3") {
		const fee = Number(
			tokenData?.poolFee || tokenData?.dexPair?.fee || tokenData?.fee || 0,
		);
		return fee > 0
			? {
					dexId: ZAP_DEX_ID.PANCAKE_V3,
					dexType: ZAP_DEX_TYPE.V3,
					bridgeToken: bridgeFallback,
					fee,
				}
			: null;
	}

	if (
		normalized === "PANCAKE_SWAP" ||
		normalized === "PANCAKE_V2" ||
		normalized === "" ||
		migrateModuleTag === PANCAKE_V2_MIGRATE_MODULE_TAG ||
		!migrateModuleTag
	) {
		// Default / unknown: treat as PCS V2 graduation (OpenFour main path)
		return {
			dexId: ZAP_DEX_ID.PANCAKE_V2,
			dexType: ZAP_DEX_TYPE.V2,
			bridgeToken: bridgeFallback,
			fee: 0,
		};
	}

	return null;
}

export async function readMigrateModuleTag(
	tokenAddress: Address,
): Promise<string> {
	try {
		const chainId = getActiveChain().id;
		const migrateModule = (await readContract(wagmiConfig, {
			address: tokenAddress,
			abi: TOKEN_MIGRATE_MODULE_ABI,
			functionName: "migrateModule",
			chainId,
		})) as Address;
		if (!isAddress(migrateModule) || migrateModule === zeroAddress) return "";
		const [, tag] = (await readContract(wagmiConfig, {
			address: migrateModule,
			abi: TAG_DESCRIPTOR_ABI,
			functionName: "descriptor",
			chainId,
		})) as [Hex, string, string];
		return tag || "";
	} catch {
		return "";
	}
}

/**
 * Contract addresses and OpenFour create / trade helpers.
 */
"use client";

import {
	readContract,
	simulateContract,
	waitForTransactionReceipt,
	writeContract,
} from "wagmi/actions";
import {
	decodeAbiParameters,
	erc20Abi,
	formatEther,
	type Address,
	type Hex,
} from "viem";
import openFourCoreAbi from "@/abi/open-four-core.json";
import openFourToolsAbi from "@/abi/open-four-tools.json";
import { publicEnv } from "./env";
import { memeGet, memePost } from "./meme-api";
import { getActiveChain, toMemeApiNetworkName } from "./chain";
import { normalizeOptionalCreateUrl } from "./create-url";
import {
	isTaxTokenSchema,
	taxInfoToFormFields,
	validateCreateTaxInfo,
	type CreateTaxInfo,
} from "./create-tax";
import {
	defaultFormFromSchema,
	encodeModuleParams,
	mapModuleSchema,
	type ModuleSchema,
} from "./open-four-encode";
import { writeWithGas, type TxGasOverrides } from "./tx-gas";
import { wagmiConfig } from "./wagmi";

export { isTaxTokenSchema };
export type { CreateTaxInfo };

export type Contracts = {
	OpenFourCore: Address;
	OpenFourTools: Address;
	OpenFourRegistry: Address;
};

export async function loadContracts(): Promise<Contracts> {
	const res = await memeGet<Array<{ name: string; address: string }>>(
		"/meme-api/api/v1/public/address",
		{ networkCode: toMemeApiNetworkName() },
	);
	if (res.code !== 0) throw new Error(res.msg || "Failed to load addresses");
	const map = Object.fromEntries(res.data.map((r) => [r.name, r.address]));
	const need = ["OpenFourCore", "OpenFourTools", "OpenFourRegistry"] as const;
	for (const k of need) {
		if (!map[k]) throw new Error(`Missing contract ${k}`);
	}
	return {
		OpenFourCore: map.OpenFourCore as Address,
		OpenFourTools: map.OpenFourTools as Address,
		OpenFourRegistry: map.OpenFourRegistry as Address,
	};
}

export type TemplateSymbolConfig = {
	id: number;
	symbol: string;
	symbolAddress: string;
	fullName: string;
	totalSupply: string;
	saleAmount: string;
	raisedAmount: string;
	createFee: string;
	decimals: number;
	logoUrl?: string;
};

export type CommonConfigItem = {
	symbol: string;
	nativeSymbol?: string;
	symbolAddress?: string;
	logoUrl?: string;
	/** Target raise amount for this quote (meme-api public config). */
	totalBAmount?: string | number;
	raisedAmount?: string | number;
	decimals?: number;
};

export async function loadTemplateConfig(
	templateId = publicEnv.openFourTemplateId,
) {
	const res = await memeGet<TemplateSymbolConfig[]>(
		"/meme-api/v1/public/token_template/config",
		{ templateId },
	);
	if (res.code !== 0) throw new Error(res.msg || "Failed to load template");
	return res.data;
}

/** `/meme-api/v1/public/config` — quote tokens include logoUrl */
export async function loadCommonConfig() {
	const res = await memeGet<CommonConfigItem[]>("/meme-api/v1/public/config");
	if (res.code !== 0) throw new Error(res.msg || "Failed to load config");
	return res.data || [];
}

function matchCommonConfig(
	commonConfig: CommonConfigItem[],
	symbol: string,
): CommonConfigItem | undefined {
	const target = symbol.trim().toLowerCase();
	if (!target) return undefined;
	return commonConfig.find(
		(item) =>
			item.symbol?.trim().toLowerCase() === target ||
			item.nativeSymbol?.trim().toLowerCase() === target,
	);
}

/** Enrich template raised list with public config logoUrl (same as meme-launcher enrichRaisedTokenList) */
export function enrichRaisedWithLogos(
	templateConfig: TemplateSymbolConfig[],
	commonConfig: CommonConfigItem[],
): TemplateSymbolConfig[] {
	if (!templateConfig?.length) return [];
	return templateConfig.map((item) => {
		const common = matchCommonConfig(commonConfig, item.symbol);
		if (!common?.logoUrl) return item;
		return { ...item, logoUrl: common.logoUrl };
	});
}

export async function loadSchemas(
	tools: Address,
	presetId: number,
): Promise<Record<string, ModuleSchema>> {
	const raw = await readContract(wagmiConfig, {
		address: tools,
		abi: openFourToolsAbi,
		functionName: "getPresetEncodeSchemas",
		args: [BigInt(presetId)],
		chainId: getActiveChain().id,
	});
	const [token, vault, curve, trade, migrate, customData] = raw as [
		Parameters<typeof mapModuleSchema>[0],
		Parameters<typeof mapModuleSchema>[0],
		Parameters<typeof mapModuleSchema>[0],
		Parameters<typeof mapModuleSchema>[0],
		Parameters<typeof mapModuleSchema>[0],
		Parameters<typeof mapModuleSchema>[0],
	];
	return {
		token: mapModuleSchema(token),
		vault: mapModuleSchema(vault),
		curve: mapModuleSchema(curve),
		trade: mapModuleSchema(trade),
		migrate: mapModuleSchema(migrate),
		customData: mapModuleSchema(customData),
	};
}

export type CreateInput = {
	name: string;
	shortName: string;
	imgUrl: string;
	desc?: string;
	webUrl?: string;
	twitterUrl?: string;
	telegramUrl?: string;
	/** anti-sniper；API feePlan */
	feePlan?: boolean;
	/** Pre-buy quote amount at create (human-readable, optional) */
	presaleQuote?: string;
	raised: TemplateSymbolConfig;
	account: Address;
	/** OpenFour preset / template id for this create */
	templateId: number;
	/** Required for tax templates */
	tax?: CreateTaxInfo | null;
};

export async function createOpenFourToken(input: CreateInput) {
	const contracts = await loadContracts();
	const templateId = input.templateId;
	if (!Number.isFinite(templateId) || templateId <= 0) {
		throw new Error("Missing OpenFour template id");
	}
	const schemas = await loadSchemas(contracts.OpenFourTools, templateId);
	const taxTemplate = isTaxTokenSchema(schemas.token.params);

	if (taxTemplate) {
		if (!input.tax) throw new Error("Tax template requires fee rates and allocation");
		const taxErr = validateCreateTaxInfo(input.tax);
		if (taxErr) throw new Error(taxErr);
	}

	const taxFields =
		taxTemplate && input.tax
			? taxInfoToFormFields(input.tax, input.account)
			: {};

	const baseForm: Record<string, unknown> = {
		...defaultFormFromSchema(schemas.token.params),
		...defaultFormFromSchema(schemas.curve.params),
		...defaultFormFromSchema(schemas.trade.params),
		...defaultFormFromSchema(schemas.migrate.params),
		name: input.name,
		symbol: input.shortName,
		shortName: input.shortName,
		quoteAsset: input.raised.symbolAddress,
		raiseAmount: input.raised.raisedAmount,
		saleAmount: input.raised.saleAmount,
		maxSupply: input.raised.totalSupply,
		founder: input.account,
		...taxFields,
	};

	const initParams = {
		tokenParams: encodeModuleParams(schemas.token, baseForm),
		vaultParams: "0x" as Hex,
		curveParams: encodeModuleParams(schemas.curve, baseForm),
		tradeParams: encodeModuleParams(schemas.trade, baseForm),
		migrateParams: encodeModuleParams(schemas.migrate, baseForm),
		customDataParams: "0x" as Hex,
	};

	const feePlan = input.feePlan !== false;
	const presaleQuoteRaw = String(input.presaleQuote ?? "").trim();
	const presaleQuoteNum = Number(presaleQuoteRaw);
	const presaleQuote =
		presaleQuoteRaw && Number.isFinite(presaleQuoteNum) && presaleQuoteNum > 0
			? presaleQuoteRaw
			: 0;

	const api = await memePost<{
		tokenId: number;
		createArg: Hex;
		signature: Hex;
	}>("/meme-api/v1/private/token_template/token/create", {
		templateId,
		imgUrl: input.imgUrl,
		name: input.name,
		shortName: input.shortName,
		symbol: input.raised.symbol,
		desc: (input.desc ?? "").trim(),
		...((): Record<string, string> => {
			const webUrl = normalizeOptionalCreateUrl(input.webUrl);
			const twitterUrl = normalizeOptionalCreateUrl(input.twitterUrl);
			const telegramUrl = normalizeOptionalCreateUrl(input.telegramUrl);
			return {
				...(webUrl ? { webUrl } : {}),
				...(twitterUrl ? { twitterUrl } : {}),
				...(telegramUrl ? { telegramUrl } : {}),
			};
		})(),
		presaleQuote,
		feePlan,
		// Keep template raisedAmount as the original string (launcher totalBAmount).
		raisedAmount: input.raised.raisedAmount,
		saleAmount: Number(input.raised.saleAmount) || 0,
		totalSupply: Number(input.raised.totalSupply) || 0,
		initParams,
	});

	if (api.code !== 0 || !api.data) {
		throw new Error(api.msg || "Create API failed");
	}

	const { createArg, signature, tokenId } = api.data;
	const decoded = decodeCreateArg(createArg);
	if (!decoded) throw new Error("Invalid createArg returned by meme-web");

	// Match OpenFourCoreLib: presale uses msg.value iff quoteAsset == wrappedNative.
	// On Robin testnet, RETH address IS wrappedNative — symbol "RETH"≠"ETH" must not decide.
	const wrappedNative = (await readContract(wagmiConfig, {
		address: contracts.OpenFourCore,
		abi: openFourCoreAbi,
		functionName: "wrappedNative",
	})) as Address;
	const quoteAsset = decoded.quoteAsset;
	const presaleUsesNative =
		decoded.presaleQuote > 0n &&
		quoteAsset.toLowerCase() === wrappedNative.toLowerCase();
	const txValue =
		decoded.createFee + (presaleUsesNative ? decoded.presaleQuote : 0n);

	if (!presaleUsesNative && decoded.presaleQuote > 0n) {
		await ensureAllowance({
			token: quoteAsset,
			owner: input.account,
			spender: contracts.OpenFourCore,
			amount: decoded.presaleQuote,
		});
	}

	const { request } = await simulateContract(wagmiConfig, {
		account: input.account,
		abi: openFourCoreAbi,
		address: contracts.OpenFourCore,
		functionName: "createToken",
		args: [createArg, signature],
		value: txValue,
	});

	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });

	// Poll backend until the token address is indexed
	let address = "";
	for (let i = 0; i < 20; i++) {
		await sleep(1500);
		const detail = await memeGet<{ address?: string }>(
			"/meme-api/v1/private/token/getById",
			{ id: tokenId },
		);
		if (detail.code === 0 && detail.data?.address) {
			address = detail.data.address;
			break;
		}
	}

	return { tokenId, hash, address };
}

const CREATE_ARGS_ABI = [
	{
		name: "args",
		type: "tuple",
		components: [
			{ name: "requestId", type: "uint256" },
			{ name: "presetId", type: "uint256" },
			{ name: "validTimestamp", type: "uint256" },
			{ name: "createFee", type: "uint256" },
			{ name: "presaleQuote", type: "uint256" },
			{ name: "antiSniperEnabled", type: "bool" },
			// meme-web fills a real partner or the zero address; never omitted from createArg.
			{ name: "partner", type: "address" },
			{
				name: "initParams",
				type: "tuple",
				components: [
					{ name: "name", type: "string" },
					{ name: "symbol", type: "string" },
					{ name: "tokenUri", type: "string" },
					{ name: "maxSupply", type: "uint256" },
					{ name: "saleAmount", type: "uint256" },
					{ name: "raiseAmount", type: "uint256" },
					{ name: "quoteAsset", type: "address" },
					{ name: "tokenSalt", type: "bytes32" },
					{ name: "tokenParams", type: "bytes" },
					{ name: "vaultParams", type: "bytes" },
					{ name: "curveParams", type: "bytes" },
					{ name: "tradeParams", type: "bytes" },
					{ name: "migrateParams", type: "bytes" },
					{ name: "customDataParams", type: "bytes" },
				],
			},
		],
	},
] as const;

function decodeCreateArg(createArg: Hex): {
	createFee: bigint;
	presaleQuote: bigint;
	quoteAsset: Address;
} | null {
	try {
		const [tuple] = decodeAbiParameters(CREATE_ARGS_ABI, createArg);
		return {
			createFee: tuple.createFee,
			presaleQuote: tuple.presaleQuote,
			quoteAsset: tuple.initParams.quoteAsset as Address,
		};
	} catch {
		return null;
	}
}

/** Whether create/prebuy pays native (msg.value) for this quote — same rule as Core. */
export async function isCreateQuoteNativePayment(
	quoteAddress?: string | null,
): Promise<boolean> {
	if (!quoteAddress) return false;
	try {
		const contracts = await loadContracts();
		const wrappedNative = (await readContract(wagmiConfig, {
			address: contracts.OpenFourCore,
			abi: openFourCoreAbi,
			functionName: "wrappedNative",
		})) as Address;
		return (
			quoteAddress.toLowerCase() === String(wrappedNative).toLowerCase()
		);
	} catch {
		return false;
	}
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

/** V12 quote by BNB budget */
export async function estimateBuyByBudget(params: {
	tools: Address;
	token: Address;
	user: Address;
	budgetEth: string;
	options: bigint;
}) {
	const { parseEther } = await import("viem");
	const value = parseEther(params.budgetEth);
	const result = await readContract(wagmiConfig, {
		address: params.tools,
		abi: openFourToolsAbi,
		functionName: "estimateBuyByBudget",
		args: [params.token, params.user, value, params.options, "0x"],
	});
	return result as {
		curveQuote: bigint;
		totalFee: bigint;
		userPays: bigint;
		userReceives: bigint;
		tokenAmount: bigint;
	};
}

export async function buyTokenV12(params: {
	core: Address;
	account: Address;
	token: Address;
	tokenAmount: bigint;
	maxQuote: bigint;
	value: bigint;
	options: bigint;
	quoteAsset?: Address;
	gasPrice?: bigint;
	gas?: bigint;
}) {
	if (params.options === 0n && params.quoteAsset) {
		await ensureAllowance({
			token: params.quoteAsset,
			owner: params.account,
			spender: params.core,
			amount: params.maxQuote,
		});
	}
	const args = [
		params.token,
		params.tokenAmount,
		params.maxQuote,
		params.options,
		"0x",
	] as const;
	const { request } = await simulateContract(wagmiConfig, {
		account: params.account,
		abi: openFourCoreAbi,
		address: params.core,
		functionName: "buy",
		args: [...args],
		value: params.value,
	});
	const gas: TxGasOverrides = {
		gasPrice: params.gasPrice,
		gas: params.gas,
	};
	const hash = await writeWithGas(request, gas);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}

export async function sellTokenV12(params: {
	core: Address;
	account: Address;
	token: Address;
	tokenAmount: bigint;
	minQuote: bigint;
	options: bigint;
	gasPrice?: bigint;
	gas?: bigint;
}) {
	await ensureAllowance({
		token: params.token,
		owner: params.account,
		spender: params.core,
		amount: params.tokenAmount,
	});

	const args = [
		params.token,
		params.tokenAmount,
		params.minQuote,
		params.options,
		"0x",
	] as const;
	const { request } = await simulateContract(wagmiConfig, {
		account: params.account,
		abi: openFourCoreAbi,
		address: params.core,
		functionName: "sell",
		args: [...args],
	});
	const gas: TxGasOverrides = {
		gasPrice: params.gasPrice,
		gas: params.gas,
	};
	const hash = await writeWithGas(request, gas);
	await waitForTransactionReceipt(wagmiConfig, { hash });
	return hash;
}

export async function estimateSell(params: {
	tools: Address;
	token: Address;
	user: Address;
	amount: bigint;
	options: bigint;
}) {
	const result = await readContract(wagmiConfig, {
		address: params.tools,
		abi: openFourToolsAbi,
		functionName: "estimateSell",
		args: [params.token, params.user, params.amount, params.options, "0x"],
	});
	return result as {
		curveQuote: bigint;
		totalFee: bigint;
		userPays: bigint;
		userReceives: bigint;
		tokenAmount: bigint;
	};
}

async function ensureAllowance(params: {
	token: Address;
	owner: Address;
	spender: Address;
	amount: bigint;
}) {
	const allowance = await readContract(wagmiConfig, {
		address: params.token,
		abi: erc20Abi,
		functionName: "allowance",
		args: [params.owner, params.spender],
	});
	if (allowance >= params.amount) return;

	const { request } = await simulateContract(wagmiConfig, {
		account: params.owner,
		abi: erc20Abi,
		address: params.token,
		functionName: "approve",
		args: [params.spender, params.amount],
	});
	const hash = await writeContract(wagmiConfig, request);
	await waitForTransactionReceipt(wagmiConfig, { hash });
}

export { formatEther };

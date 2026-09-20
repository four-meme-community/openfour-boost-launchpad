/**
 * OpenFour TaxVaultRegistry helpers for create-time royalty templates.
 * ForwardVault (Unverified Royalty) = keccak256("SafuSkill.ForwardVault.v1").
 */
"use client";

import { readContract } from "wagmi/actions";
import { zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { getActiveChain } from "./chain";
import {
	mapModuleSchema,
	type ModuleSchema,
} from "./open-four-encode";
import { wagmiConfig } from "./wagmi";

/** keccak256("SafuSkill.ForwardVault.v1") — Unverified Royalty / ForwardVault */
export const UNVERIFIED_ROYALTY_TYPE_ID =
	"0x31305495a6a67b3607bd1db8a49c23bbd2dc1d0fc23df7f46f7c94da62d6c99a" as Hex;

export const NO_TAX_VAULT_TYPE_ID = zeroHash;

export type TaxVaultTypeView = {
	typeId: Hex;
	name: string;
	version: string;
	description: string;
	active: boolean;
	beacon: Address;
	implementation: Address;
};

export type SchemaLoadStatus =
	| "idle"
	| "loading"
	| "valid"
	| "incomplete"
	| "error";

export type TaxVaultSelection = {
	typeId: Hex;
	initParamsHex: Hex;
	schemaLoadStatus: SchemaLoadStatus;
};

export const DEFAULT_TAX_VAULT_SELECTION: TaxVaultSelection = {
	typeId: NO_TAX_VAULT_TYPE_ID,
	initParamsHex: "0x",
	schemaLoadStatus: "valid",
};

const registryAbi = [
	{
		inputs: [],
		name: "taxVaultRegistry",
		outputs: [{ internalType: "address", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
] as const;

const taxVaultRegistryAbi = [
	{
		inputs: [],
		name: "getVaultTypeList",
		outputs: [
			{
				components: [
					{ internalType: "bytes32", name: "typeId", type: "bytes32" },
					{ internalType: "address", name: "beacon", type: "address" },
					{ internalType: "address", name: "implementation", type: "address" },
					{ internalType: "string", name: "name", type: "string" },
					{ internalType: "string", name: "version", type: "string" },
					{ internalType: "string", name: "description", type: "string" },
					{ internalType: "bool", name: "active", type: "bool" },
				],
				internalType: "struct TaxVaultRegistry.VaultTypeView[]",
				name: "list",
				type: "tuple[]",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ internalType: "bytes32", name: "typeId", type: "bytes32" }],
		name: "getVaultTypeEncodeSchema",
		outputs: [
			{
				components: [
					{ internalType: "string", name: "kind", type: "string" },
					{ internalType: "uint8", name: "version", type: "uint8" },
					{
						components: [
							{ internalType: "string", name: "name", type: "string" },
							{ internalType: "string", name: "abiType", type: "string" },
							{ internalType: "uint8", name: "decimals", type: "uint8" },
							{ internalType: "bool", name: "optional", type: "bool" },
							{ internalType: "string", name: "title", type: "string" },
							{ internalType: "string", name: "defaultValue", type: "string" },
							{ internalType: "string", name: "hint", type: "string" },
							{ internalType: "string", name: "minValue", type: "string" },
							{ internalType: "string", name: "maxValue", type: "string" },
						],
						internalType: "struct ParamDescriptor[]",
						name: "params",
						type: "tuple[]",
					},
				],
				internalType: "struct ModuleEncodeSchema",
				name: "schema",
				type: "tuple",
			},
		],
		stateMutability: "view",
		type: "function",
	},
] as const;

export const templateSchemaAbi = [
	{
		inputs: [],
		name: "moduleEncodeSchema",
		outputs: [
			{
				components: [
					{ internalType: "string", name: "kind", type: "string" },
					{ internalType: "uint8", name: "version", type: "uint8" },
					{
						components: [
							{ internalType: "string", name: "name", type: "string" },
							{ internalType: "string", name: "abiType", type: "string" },
							{ internalType: "uint8", name: "decimals", type: "uint8" },
							{ internalType: "bool", name: "optional", type: "bool" },
							{ internalType: "string", name: "title", type: "string" },
							{ internalType: "string", name: "defaultValue", type: "string" },
							{ internalType: "string", name: "hint", type: "string" },
							{ internalType: "string", name: "minValue", type: "string" },
							{ internalType: "string", name: "maxValue", type: "string" },
						],
						internalType: "struct ParamDescriptor[]",
						name: "params",
						type: "tuple[]",
					},
				],
				internalType: "struct ModuleEncodeSchema",
				name: "",
				type: "tuple",
			},
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "authorWallet",
		outputs: [{ internalType: "address", name: "", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
] as const;

export function isUnverifiedRoyalty(typeId?: string | null): boolean {
	if (!typeId) return false;
	return typeId.toLowerCase() === UNVERIFIED_ROYALTY_TYPE_ID.toLowerCase();
}

export function isCustomRoyalty(typeId?: string | null): boolean {
	if (!typeId) return true;
	return typeId.toLowerCase() === NO_TAX_VAULT_TYPE_ID.toLowerCase();
}

export function isForwardVaultSchema(schema: ModuleSchema | null | undefined): boolean {
	return schema?.kind === "SafuSkill.ForwardVault";
}

export async function loadTaxVaultRegistryAddress(
	openFourRegistry: Address,
): Promise<Address | null> {
	const addr = (await readContract(wagmiConfig, {
		address: openFourRegistry,
		abi: registryAbi,
		functionName: "taxVaultRegistry",
		chainId: getActiveChain().id,
	})) as Address;
	if (!addr || addr === zeroAddress) return null;
	return addr;
}

export async function loadVaultTypeList(
	registry: Address,
): Promise<TaxVaultTypeView[]> {
	const result = await readContract(wagmiConfig, {
		address: registry,
		abi: taxVaultRegistryAbi,
		functionName: "getVaultTypeList",
		chainId: getActiveChain().id,
	});
	return Array.from(result as TaxVaultTypeView[])
		.map((v) => ({
			typeId: v.typeId as Hex,
			name: v.name,
			version: v.version,
			description: v.description,
			active: Boolean(v.active),
			beacon: v.beacon as Address,
			implementation: v.implementation as Address,
		}))
		.filter((v) => v.active);
}

export async function loadVaultTypeEncodeSchema(
	registry: Address,
	typeId: Hex,
): Promise<ModuleSchema> {
	if (!typeId || typeId === NO_TAX_VAULT_TYPE_ID) {
		return { kind: "taxvault", version: 1, params: [] };
	}
	const raw = await readContract(wagmiConfig, {
		address: registry,
		abi: taxVaultRegistryAbi,
		functionName: "getVaultTypeEncodeSchema",
		args: [typeId],
		chainId: getActiveChain().id,
	});
	return mapModuleSchema(
		raw as Parameters<typeof mapModuleSchema>[0],
	);
}

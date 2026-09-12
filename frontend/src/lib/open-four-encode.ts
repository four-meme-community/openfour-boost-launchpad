/**
 * OpenFour module param encoding (slim port of meme-launcher encodeModuleParams).
 */
import {
	encodeAbiParameters,
	parseAbiParameters,
	parseUnits,
	zeroAddress,
} from "viem";

export type ParamDesc = {
	name: string;
	abiType: string;
	decimals: number;
	optional: boolean;
	defaultValue: string;
	title?: string;
};

export type ModuleSchema = {
	kind: string;
	version: number;
	params: ParamDesc[];
};

function zeroValue(abiType: string): unknown {
	if (abiType === "address") return zeroAddress;
	if (abiType === "bool") return false;
	if (abiType === "string") return "";
	if (abiType === "bytes") return "0x";
	if (abiType === "bytes32")
		return "0x0000000000000000000000000000000000000000000000000000000000000000";
	if (abiType.endsWith("[]")) return [];
	return 0n;
}

function parseArrayValue(raw: unknown): unknown[] {
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed;
		} catch {
			return raw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
		}
	}
	return [];
}

function resolveParam(desc: ParamDesc, form: Record<string, unknown>): unknown {
	const raw = form[desc.name];
	const str = String(raw ?? "").trim();
	const missing = raw == null || str === "";

	if (missing) {
		if (desc.optional) return zeroValue(desc.abiType);
		throw new Error(`Required param "${desc.name}" is missing`);
	}

	switch (desc.abiType) {
		case "address[]":
			return parseArrayValue(raw).map((v) => String(v).trim());
		case "uint16[]":
		case "uint256[]":
			return parseArrayValue(raw).map((v) => {
				const s = String(v).trim();
				return desc.decimals > 0 ? parseUnits(s, desc.decimals) : BigInt(s);
			});
		case "bool":
			if (typeof raw === "boolean") return raw;
			return str === "true" || str === "1";
		case "address":
			return str || zeroAddress;
		case "string":
			return str;
		case "bytes32":
			return (
				str ||
				"0x0000000000000000000000000000000000000000000000000000000000000000"
			);
		case "bytes":
			return str || "0x";
		default:
			if (desc.decimals > 0) return parseUnits(str, desc.decimals);
			return BigInt(str);
	}
}

export function mapModuleSchema(raw: {
	kind: string;
	version: bigint | number;
	params: Array<{
		name: string;
		abiType: string;
		decimals: bigint | number;
		optional: boolean;
		defaultValue: string;
		title?: string;
	}>;
}): ModuleSchema {
	return {
		kind: raw.kind,
		version: Number(raw.version),
		params: Array.from(raw.params).map((p) => ({
			name: p.name,
			abiType: p.abiType,
			decimals: Number(p.decimals),
			optional: p.optional,
			defaultValue: p.defaultValue,
			title: p.title,
		})),
	};
}

export function defaultFormFromSchema(params: ParamDesc[]) {
	const out: Record<string, unknown> = {};
	for (const p of params) {
		if (p.defaultValue !== "") out[p.name] = p.defaultValue;
	}
	return out;
}

export function encodeModuleParams(
	schema: ModuleSchema,
	form: Record<string, unknown>,
): `0x${string}` {
	if (!schema.params.length) return "0x";
	const types = schema.params.map((p) => p.abiType);
	const values = schema.params.map((p) => resolveParam(p, form));
	const tupleType = `(${types.join(",")})`;
	return encodeAbiParameters(parseAbiParameters(tupleType), [values]);
}

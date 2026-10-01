/**
 * Token detail + chart + trade.
 * Left list lives in /token/layout.tsx; address change re-renders this page only (soft nav).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { erc20Abi, isAddress, type Address } from "viem";
import { readContract } from "wagmi/actions";
import { TokenBelowChart } from "@/components/token-below-chart";
import { TokenChart } from "@/components/token-chart";
import {
	TokenHeader,
	type TokenHeaderTicker,
} from "@/components/token-header";
import { TokenDetailSkeleton } from "@/components/token-detail-skeleton";
import { TradeDocker } from "@/components/trade-docker";
import { getActiveChain, toMemeApiNetworkCode } from "@/lib/chain";
import { getPublicChainByCode } from "@/lib/chain-config";
import { publicEnv } from "@/lib/env";
import {
	isTokenOnDex,
	memeGet,
	type TokenDetail,
} from "@/lib/meme-api";
import { getClientMemeNetworkCode } from "@/lib/network";
import {
	loadCommonConfig,
	loadTemplateConfig,
	type CommonConfigItem,
	type TemplateSymbolConfig,
} from "@/lib/open-four";
import { wagmiConfig } from "@/lib/wagmi";
import type { TokenZapMeta } from "@/lib/zap-route";
import { useI18n } from "@/i18n/provider";

type TokenDetailExtra = {
	image?: string;
	descr?: string;
	webUrl?: string;
	telegramUrl?: string;
	twitterUrl?: string;
	dexPair?: {
		pairAddress?: string;
		pancakeVersion?: string | number;
	};
};

type TokenPayload = TokenDetail & {
	totalAmount?: string;
	saleAmount?: string;
	raisedAmount?: string;
	decimals?: number;
	quoteAddress?: string;
	quoteDecimals?: number;
	dexPair?: {
		pairAddress?: string;
		pancakeVersion?: string | number;
	};
	userAddress?: string;
	createDate?: string;
	twitterUrl?: string;
	telegramUrl?: string;
	webUrl?: string;
};

/** Quote raise target + address: current-chain templates first, then public config. */
async function resolveQuoteMeta(symbol: string): Promise<{
	raisedAmount?: string;
	symbolAddress?: string;
	decimals?: number;
} | null> {
	const target = symbol.trim().toUpperCase();
	if (!target) return null;

	const chain = getPublicChainByCode(getClientMemeNetworkCode());
	const presetIds = (chain.presetIds?.length
		? chain.presetIds
		: [String(publicEnv.openFourTemplateId)]
	).map(String);

	const templateLists = await Promise.all(
		presetIds.map((id) => {
			const n = Number(id);
			return loadTemplateConfig(Number.isFinite(n) ? n : undefined).catch(
				() => [] as TemplateSymbolConfig[],
			);
		}),
	);
	for (const list of templateLists) {
		const quote = (list || []).find(
			(item) => item.symbol?.toUpperCase() === target,
		);
		if (quote) {
			return {
				raisedAmount:
					quote.raisedAmount != null && String(quote.raisedAmount) !== ""
						? String(quote.raisedAmount)
						: undefined,
				symbolAddress: quote.symbolAddress,
				decimals: quote.decimals,
			};
		}
	}

	const common = await loadCommonConfig().catch(() => [] as CommonConfigItem[]);
	const row = (common || []).find(
		(item) => item.symbol?.toUpperCase() === target,
	);
	if (!row) return null;
	const amount = row.raisedAmount ?? row.totalBAmount;
	return {
		raisedAmount:
			amount != null && String(amount) !== "" ? String(amount) : undefined,
		symbolAddress: row.symbolAddress,
		decimals: row.decimals,
	};
}

export default function TokenPage() {
	const { t } = useI18n();
	const params = useParams<{ address: string }>();
	const address = params.address;
	const [token, setToken] = useState<TokenPayload | null>(null);
	const [ticker, setTicker] = useState<TokenHeaderTicker | null>(null);
	const [chartPrice, setChartPrice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const currentTokenId = Number(token?.id ?? token?.tokenId);

	const onLastPrice = useCallback((price: string | null) => {
		setChartPrice(price);
	}, []);

	useEffect(() => {
		setToken(null);
		setTicker(null);
		setChartPrice(null);
		setError(null);

		if (!address || !isAddress(address)) {
			setError(t("error.invalidAddress"));
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const networkCode = toMemeApiNetworkCode();
				const res = await memeGet<TokenPayload>(
					"/meme-api/api/v1/public/token",
					{ address, networkCode },
				);
				if (cancelled) return;
				if (res.code !== 0) throw new Error("load_failed");

				const detail = await memeGet<TokenDetailExtra>(
					"/meme-api/api/v1/public/token/detail",
					{ address, networkCode },
				);
				if (cancelled) return;

				const nextToken: TokenPayload = {
					...res.data,
					address: res.data.address || address,
					image:
						detail.code === 0
							? detail.data?.image
							: res.data.image || res.data.img,
					descr: detail.code === 0 ? detail.data?.descr : undefined,
					twitterUrl:
						detail.code === 0 ? detail.data?.twitterUrl : undefined,
					telegramUrl:
						detail.code === 0 ? detail.data?.telegramUrl : undefined,
					webUrl: detail.code === 0 ? detail.data?.webUrl : undefined,
					dexPair:
						detail.code === 0 && detail.data?.dexPair
							? detail.data.dexPair
							: res.data.dexPair,
				};

				if (nextToken.symbol) {
					try {
						const quote = await resolveQuoteMeta(nextToken.symbol);
						if (quote) {
							if (
								nextToken.raisedAmount == null ||
								nextToken.raisedAmount === ""
							) {
								nextToken.raisedAmount = quote.raisedAmount;
							}
							if (quote.symbolAddress) {
								nextToken.quoteAddress = quote.symbolAddress;
							}
							if (quote.decimals != null) {
								nextToken.quoteDecimals = quote.decimals;
							}
						}
					} catch {
						// ignore
					}
				}

				setToken(nextToken);
				const chainId = getActiveChain().id;
				void Promise.all([
					readContract(wagmiConfig, {
						address: nextToken.address as Address,
						abi: erc20Abi,
						functionName: "symbol",
						chainId,
					}),
					readContract(wagmiConfig, {
						address: nextToken.address as Address,
						abi: erc20Abi,
						functionName: "decimals",
						chainId,
					}),
				])
					.then(([tokenSymbol, decimals]) => {
						if (cancelled) return;
						setToken((prev) =>
							prev
								? {
										...prev,
										shortName: String(tokenSymbol),
										decimals: Number(decimals),
									}
								: prev,
						);
					})
					.catch(() => {
						// API shortName remains the symbol fallback.
					});

				const tokenId = Number(nextToken.id ?? nextToken.tokenId);
				if (Number.isFinite(tokenId) && tokenId > 0) {
					const tick = await memeGet<TokenHeaderTicker>(
						"/meme-api/api/v1/public/token/ticker",
						{ tokenId },
					);
					if (!cancelled && tick.code === 0) {
						setTicker(tick.data);
					}
				}
			} catch {
				if (!cancelled) {
					setError(t("error.load"));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [address, t]);

	// Live price drives price/mcap immediately; ticker poll fills volume, progress, raised, etc.
	useEffect(() => {
		if (!Number.isFinite(currentTokenId) || currentTokenId <= 0) return;

		let cancelled = false;
		const refreshTicker = async () => {
			if (document.visibilityState === "hidden") return;
			try {
				const tick = await memeGet<TokenHeaderTicker>(
					"/meme-api/api/v1/public/token/ticker",
					{ tokenId: currentTokenId },
				);
				if (!cancelled && tick.code === 0) setTicker(tick.data);
			} catch {
				// Keep last good snapshot and refresh next round.
			}
		};

		const timer = window.setInterval(refreshTicker, 8_000);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [currentTokenId]);

	if (error) return <p className="err">{error}</p>;
	if (!token) return <TokenDetailSkeleton />;

	const tokenId = currentTokenId;
	const status = ticker?.status ?? token.status;
	const onDex = isTokenOnDex(status);
	const headerToken = {
		name: token.name,
		shortName: token.shortName,
		symbol: token.symbol,
		address: token.address || address,
		image: token.image || token.img,
		descr: token.descr,
		status,
		createDate: token.createDate,
		totalAmount: token.totalAmount,
		saleAmount: token.saleAmount,
		raisedAmount: token.raisedAmount,
		decimals: token.decimals,
		quoteAddress: token.quoteAddress,
		quoteDecimals: token.quoteDecimals,
		pairAddress: token.dexPair?.pairAddress,
		pancakeVersion: token.dexPair?.pancakeVersion,
		userAddress: token.userAddress,
		twitterUrl: token.twitterUrl,
		telegramUrl: token.telegramUrl,
		webUrl: token.webUrl,
	};

	return (
		<section className="detail">
			<div className="detail-main">
				<div className="detail-chart-col">
					<TokenHeader
						token={headerToken}
						ticker={ticker}
						livePrice={chartPrice}
					/>

					{Number.isFinite(tokenId) && tokenId > 0 ? (
						<TokenChart
							tokenId={tokenId}
							onDex={onDex}
							raisedSymbol={token.symbol}
							onLastPrice={onLastPrice}
						/>
					) : (
						<p className="muted">{t("token.missingChartId")}</p>
					)}

					{Number.isFinite(tokenId) && tokenId > 0 ? (
						<TokenBelowChart
							tokenId={tokenId}
							totalAmount={token.totalAmount}
							creator={token.userAddress}
							tokenAddress={token.address || address}
							quoteSymbol={token.symbol || "BNB"}
							holderCount={ticker?.holderCount}
						/>
					) : null}
				</div>

				{isAddress(address) ? (
					<TradeDocker
						token={headerToken}
						ticker={ticker}
						livePrice={chartPrice}
						tokenAddress={address as Address}
						onDex={onDex}
						tokenMeta={token as TokenZapMeta}
					/>
				) : null}
			</div>
		</section>
	);
}

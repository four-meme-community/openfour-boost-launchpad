/**
 * Site config from BFF `/v1/config` (branding + switchable chains).
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { applySiteChains } from "@/lib/chain-config";
import type { SiteConfig } from "@/lib/bff";

const SiteConfigContext = createContext<SiteConfig | null>(null);

export function SiteConfigProvider({
	config,
	children,
}: {
	config: SiteConfig;
	children: ReactNode;
}) {
	applySiteChains(config.chains, config.defaultChain);
	return (
		<SiteConfigContext.Provider value={config}>
			{children}
		</SiteConfigContext.Provider>
	);
}

export function useSiteConfig(): SiteConfig {
	const value = useContext(SiteConfigContext);
	if (!value) throw new Error("useSiteConfig must be used within SiteConfigProvider");
	return value;
}

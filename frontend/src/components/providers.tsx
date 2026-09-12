/**
 * Client providers: React Query + Wagmi + Toast.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/hooks/auth-provider";
import { SiteConfigProvider } from "@/hooks/site-config";
import type { SiteConfig } from "@/lib/bff";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({
	siteConfig,
	children,
}: {
	siteConfig: SiteConfig;
	children: ReactNode;
}) {
	const [queryClient] = useState(() => new QueryClient());
	return (
		<SiteConfigProvider config={siteConfig}>
			<WagmiProvider config={wagmiConfig}>
				<QueryClientProvider client={queryClient}>
					<ToastProvider>
						<AuthProvider>{children}</AuthProvider>
					</ToastProvider>
				</QueryClientProvider>
			</WagmiProvider>
		</SiteConfigProvider>
	);
}

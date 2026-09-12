/**
 * Client providers: React Query + Wagmi + Toast.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/hooks/auth-provider";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<AuthProvider>{children}</AuthProvider>
				</ToastProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}

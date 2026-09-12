/**
 * /token/* layout: left list stays mounted; address change swaps right children (soft nav).
 */
"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { TokenSideList } from "@/components/token-side-list";

export default function TokenLayout({ children }: { children: ReactNode }) {
	const params = useParams<{ address?: string }>();
	const address = typeof params?.address === "string" ? params.address : null;

	return (
		<div className="detail-layout">
			<TokenSideList activeAddress={address} />
			{children}
		</div>
	);
}

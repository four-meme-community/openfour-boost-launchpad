/**
 * Wallet login via official-site Web API:
 * nonce → sign → login/dex → cookie user_token → header meme-web-access
 *
 * After wallet connect: restore session if possible; otherwise auto-prompt
 * personal_sign once per address (manual retry via WalletButton).
 *
 * Partner public docs have no user session; login/profile/rebate all use Web.
 *
 * One shared Context for the whole app so WalletButton and /referral stay in sync
 * (login on one page should not require a refresh elsewhere).
 *
 * Invite auto-bind from landing `?code=`:
 * share links look like `${origin}?code=CODE` or `${origin}/token/xxx?code=CODE`.
 * This root Provider is the single place that captures it.
 */
"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { getActiveChain, toMemeApiNetworkName } from "@/lib/chain";
import { bindInviteCode } from "@/lib/invite-api";
import {
	clearAccessToken,
	getAccessToken,
	memeGet,
	memePost,
	setAccessToken,
} from "@/lib/meme-api";

export type AuthStatus =
	| "idle"
	| "checking"
	| "unauthenticated"
	| "authenticating"
	| "authenticated"
	| "error";

export type UserInfo = {
	address?: string;
	userId?: number;
	userName?: string;
	avatarPath?: string;
	[k: string]: unknown;
};

type AuthContextValue = {
	status: AuthStatus;
	user: UserInfo | null;
	error: string | null;
	login: () => Promise<void>;
	logout: () => Promise<void>;
	isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const { address, isConnected, chainId } = useAccount();
	const { signMessageAsync } = useSignMessage();
	const { switchChainAsync } = useSwitchChain();
	const [status, setStatus] = useState<AuthStatus>("idle");
	const [user, setUser] = useState<UserInfo | null>(null);
	const [error, setError] = useState<string | null>(null);
	const runId = useRef(0);
	/** Invite code from landing `?code=`; in-memory only — cleared on logout/tab close */
	const [pendingInviteCode, setPendingInviteCode] = useState("");
	const boundCodeRef = useRef<string | null>(null);
	/** One auto sign-in attempt per connected address (after session check). */
	const autoLoginTriedRef = useRef("");

	useEffect(() => {
		const code = new URLSearchParams(window.location.search).get("code");
		if (code) setPendingInviteCode(code);
	}, []);

	/** Already logged in on land: bind immediately without another signature */
	useEffect(() => {
		if (!pendingInviteCode) return;
		if (status !== "authenticated") return;
		if (boundCodeRef.current === pendingInviteCode) return;
		boundCodeRef.current = pendingInviteCode;
		void bindInviteCode(pendingInviteCode).catch(() => {
			boundCodeRef.current = null;
		});
	}, [pendingInviteCode, status]);

	const loadUser = useCallback(async () => {
		const token = getAccessToken();
		if (!token) return null;
		const res = await memeGet<UserInfo>("/meme-api/v1/private/user/info");
		if (res.code !== 0 || !res.data) return null;
		return res.data;
	}, []);

	const login = useCallback(async () => {
		if (!address) throw new Error("Connect wallet first");
		const id = ++runId.current;
		setStatus("authenticating");
		setError(null);

		try {
			const targetChain = getActiveChain();
			if (chainId !== targetChain.id) {
				await switchChainAsync({ chainId: targetChain.id });
			}

			const networkCode = toMemeApiNetworkName();
			const nonceRes = await memePost<string>(
				"/meme-api/v1/private/user/nonce/generate",
				{
					accountAddress: address,
					verifyType: "LOGIN",
					networkCode,
				},
			);
			if (nonceRes.code !== 0) {
				throw new Error(nonceRes.msg || "Failed to get nonce");
			}

			const signature = await signMessageAsync({
				message: `You are sign in Meme ${nonceRes.data}`,
			});
			if (runId.current !== id) return;

			const loginRes = await memePost<string>(
				"/meme-api/v1/private/user/login/dex",
				{
					region: "OTHER",
					langType: "EN",
					inviteCode: pendingInviteCode || undefined,
					verifyInfo: {
						address,
						networkCode,
						signature,
						verifyType: "LOGIN",
					},
					walletName: "injected",
				},
			);
			if (loginRes.code !== 0 || !loginRes.data) {
				throw new Error(loginRes.msg || "Login failed");
			}

			setAccessToken(loginRes.data);
			const info = await loadUser();
			if (runId.current !== id) return;
			setUser(info);
			setStatus("authenticated");
		} catch (e) {
			if (runId.current !== id) return;
			const msg = e instanceof Error ? e.message : "Login failed";
			setError(msg);
			setStatus("error");
			throw e;
		}
	}, [
		address,
		chainId,
		loadUser,
		pendingInviteCode,
		signMessageAsync,
		switchChainAsync,
	]);

	const logout = useCallback(async () => {
		try {
			await memePost("/meme-api/v1/private/user/logout", {});
		} catch {
			// ignore
		}
		clearAccessToken();
		setUser(null);
		autoLoginTriedRef.current = "";
		setStatus("unauthenticated");
	}, []);

	const loginRef = useRef(login);
	loginRef.current = login;

	useEffect(() => {
		const id = ++runId.current;
		(async () => {
			if (!isConnected || !address) {
				setUser(null);
				autoLoginTriedRef.current = "";
				setStatus("unauthenticated");
				return;
			}
			const normalized = address.toLowerCase();
			setStatus("checking");
			try {
				const info = await loadUser();
				if (runId.current !== id) return;
				if (
					info?.address &&
					info.address.toLowerCase() === normalized
				) {
					setUser(info);
					setStatus("authenticated");
					autoLoginTriedRef.current = normalized;
					return;
				}

				setUser(null);
				if (autoLoginTriedRef.current === normalized) {
					setStatus("unauthenticated");
					return;
				}
				autoLoginTriedRef.current = normalized;
				try {
					await loginRef.current();
				} catch {
					// User reject / failure → stay unauthenticated; WalletButton can retry.
					if (runId.current === id) setStatus("unauthenticated");
				}
			} catch {
				if (runId.current !== id) return;
				setStatus("unauthenticated");
			}
		})();
	}, [address, isConnected, loadUser]);

	return (
		<AuthContext.Provider
			value={{
				status,
				user,
				error,
				login,
				logout,
				isAuthenticated: status === "authenticated",
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}

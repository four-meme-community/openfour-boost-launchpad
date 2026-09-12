import type { NextConfig } from "next";
/**
 * Thin Web: browser business APIs always go through the BFF.
 * Do not add rewrites that hit meme-web directly — keeps tenant secrets out of the browser.
 */
const nextConfig: NextConfig = {
	output: "standalone",
	poweredByHeader: false,
	reactStrictMode: true,
	webpack: (config) => {
		// WalletConnect logger optionally requires pino-pretty; unused in the browser.
		config.resolve.alias = {
			...config.resolve.alias,
			"pino-pretty": false,
		};
		return config;
	},
};

export default nextConfig;

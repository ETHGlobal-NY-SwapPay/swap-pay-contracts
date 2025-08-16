export interface NetworkConfigInfo {
	[chainId: string]: {
		blockConfirmations?: number
	}
}

export const tokenDecimals: Record<string, number> = {
	DAI: 18,
	LINK: 18,
	PYUSD: 6,
	USDC: 6,
	WBTC: 8,
	WSTETH: 18
}

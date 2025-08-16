import { zeroAddress } from 'viem'

import { NetworkConfigInfo } from '@/models'

// Hardhat and Localhost are development chains
export const developmentChains = ['hardhat', 'localhost']

export const networkConfig: NetworkConfigInfo = {
	localhost: {},
	hardhat: {},
	ethereumSepolia: {
		blockConfirmations: 3
	}
}

// Tokens
export const tokenDecimals: Record<string, number> = {
	DAI: 18,
	LINK: 18,
	PYUSD: 6,
	USDC: 6,
	WBTC: 8,
	WSTETH: 18
}

// Uniswap
export const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543'

/**
 * sqrtPriceX96 to price p = token1/token0
 * p = 1  => 2^96
 */

export const Q96 = 2n ** 96n
export const ONE_TO_ONE_SQRT_PRICE_X96 = Q96 // 79228162514264337593543950336n

export const FEE = 3000
export const TICKSPACING = 60
export const HOOKS = zeroAddress

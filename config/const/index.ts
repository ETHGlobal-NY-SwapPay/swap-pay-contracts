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
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
export const POSITION_MANAGER_ADDRESS =
	'0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4'
export const POOL_TEST_SWAP_ADDRESS =
	'0xf3a39c86dbd13c45365e57fb90fe413371f65af8'

/**
 * sqrtPriceX96 to price p = token1/token0
 * p = 1  => 2^96
 */

export const Q96 = 2n ** 96n
export const ONE_TO_ONE_SQRT_PRICE_X96 = Q96 // 79228162514264337593543950336n

export const FEE = 3000
export const TICKSPACING = 60
export const HOOKS = zeroAddress

export const LIQUIDITY: bigint = 1_000_000n
export const TICK_LOWER: number = -887220
export const TICK_UPPER: number = 887220
export const AMOUNT_MAX_ERC20: bigint = (1n << 160n) - 1n
export const PERMIT2_EXPIRATION: bigint = (1n << 48n) - 1n
export const UINT128_MAX = (1n << 128n) - 1n

export const Actions = {
	INCREASE_LIQUIDITY: 0x00,
	DECREASE_LIQUIDITY: 0x01,
	MINT_POSITION: 0x02,
	BURN_POSITION: 0x03,
	INCREASE_LIQUIDITY_FROM_DELTAS: 0x04,
	MINT_POSITION_FROM_DELTAS: 0x05,
	SWAP_EXACT_IN_SINGLE: 0x06,
	SWAP_EXACT_IN: 0x07,
	SWAP_EXACT_OUT_SINGLE: 0x08,
	SWAP_EXACT_OUT: 0x09,
	DONATE: 0x0a,
	SETTLE: 0x0b,
	SETTLE_ALL: 0x0c,
	SETTLE_PAIR: 0x0d,
	TAKE: 0x0e,
	TAKE_ALL: 0x0f,
	TAKE_PORTION: 0x10,
	TAKE_PAIR: 0x11,
	CLOSE_CURRENCY: 0x12,
	CLEAR_OR_TAKE: 0x13,
	SWEEP: 0x14,
	WRAP: 0x15,
	UNWRAP: 0x16,
	MINT_6909: 0x17,
	BURN_6909: 0x18
}

// ABIs
export const IERC20_ABI = [
	{
		name: 'approve',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' }
		],
		outputs: [{ type: 'bool' }]
	}
]

import { task } from 'hardhat/config'
import type { Address, Hex } from 'viem'
import {
	createWalletClient,
	encodeAbiParameters,
	encodeFunctionData,
	http,
	toHex,
	zeroAddress
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

// ===== Direcciones (tus mocks) =====
const ADDR = {
	DAI: '0x5aBa799fFDFc52785EFC073E11D4671a4186F3d8',
	USDC: '0xdC02992BD2700966775fDDd9ee1d8758B3Af24C5',
	LINK: '0xd76ff4D27F5D56e24B3764e08Ffd7052006B10B1',
	WBTC: '0xBf4ED0f867CFf7af2acFa4F727ef43EB89C4C195',
	WSTETH: '0x33e3BDE50A20946FFb2e2f2C6A9C4Cb291A90cfE',
	PYUSD: '0xE448eAbd8420ED396020F8dDB09A4b6F7E6040D4'
} as const

// ===== Core contracts =====
const POOL_MANAGER: Address = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543'
const POSITION_MANAGER: Address = '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4'
const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// ===== Parámetros fijos que pediste =====
const FEE = 3000
const TICK_SPACING = 60
const TICK_LOWER = -887220
const TICK_UPPER = 887220
const LIQUIDITY = 1_000_000n
const HOOK_DATA = '0x'
const AMOUNT_MAX = (1n << 160n) - 1n // 2^160-1

// ===== Decimales típicos =====
const DECIMALS = {
	DAI: 18,
	USDC: 6,
	LINK: 18,
	WBTC: 8,
	WSTETH: 18,
	PYUSD: 6
} as const

// ===== Chainlink (fallback para precios) =====
const CHAINLINK = {
	LINK_USD: '0xc59E3633BAAC79493d908e63626716e204A45EdF',
	WBTC_USD: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',
	WSTETH_USD: '0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E',
	DAI_USD: '0x14866185B1962B63C3Ea9E03Bc1da838bab34C19',
	USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E'
} as const

// ===== ABIs mínimos =====
const IERC20_ABI = [
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
] as const

const permit2Abi = [
	{
		name: 'approve',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'token', type: 'address' },
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint160' },
			{ name: 'expiration', type: 'uint48' }
		],
		outputs: []
	}
] as const

const poolManagerAbi = [
	{
		name: 'initialize',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{
				name: 'key',
				type: 'tuple',
				components: [
					{ name: 'currency0', type: 'address' },
					{ name: 'currency1', type: 'address' },
					{ name: 'fee', type: 'uint24' },
					{ name: 'tickSpacing', type: 'int24' },
					{ name: 'hooks', type: 'address' }
				]
			},
			{ name: 'sqrtPriceX96', type: 'uint160' }
		],
		outputs: [{ name: 'tick', type: 'int24' }]
	}
] as const

import positionManagerAbi from '../assets/abis/PositionManager.json' assert { type: 'json' }

const aggAbi = [
	{
		name: 'latestRoundData',
		type: 'function',
		stateMutability: 'view',
		inputs: [],
		outputs: [
			{ name: 'roundId', type: 'uint80' },
			{ name: 'answer', type: 'int256' },
			{ name: 'startedAt', type: 'uint256' },
			{ name: 'updatedAt', type: 'uint256' },
			{ name: 'answeredInRound', type: 'uint80' }
		]
	}
] as const

// ===== Helpers numéricos =====
const Q96 = 2n ** 96n
const ONE_E8 = 100_000_000n
const USD_SIDE_1E8 = 500n * ONE_E8 // $500 por lado
const SLIP_BPS = 100n // 1% buffer

function isqrt(v: bigint): bigint {
	if (v <= 0n) return 0n
	let x0 = v,
		x1 = (x0 + 1n) >> 1n
	while (x1 < x0) {
		x0 = x1
		x1 = (x1 + v / x1) >> 1n
	}
	return x0
}

// lee precio 1e8 para 1 token (stables=1e8; otros via Chainlink)
async function usd1e8For(
	sym: keyof typeof DECIMALS,
	publicClient: any
): Promise<bigint> {
	if (sym === 'DAI' || sym === 'USDC' || sym === 'PYUSD') return ONE_E8
	const feed =
		sym === 'LINK'
			? CHAINLINK.LINK_USD
			: sym === 'WBTC'
				? CHAINLINK.WBTC_USD
				: sym === 'WSTETH'
					? CHAINLINK.WSTETH_USD
					: undefined
	if (!feed) throw new Error(`No Chainlink feed for ${sym}`)
	const [, answer] = (await publicClient.readContract({
		address: feed as Address,
		abi: aggAbi,
		functionName: 'latestRoundData'
	})) as [bigint, bigint, bigint, bigint, bigint]
	if (answer <= 0n) throw new Error(`Bad price for ${sym}`)
	return answer
}

const Actions = { MINT_POSITION: 0x02, SETTLE_PAIR: 0x0d } as const

task(
	'seed-pyusd-pools',
	'Crea la pool y mete ~$500 PYUSD + equivalente en token X (sin parámetros)'
).setAction(async (_, hre) => {
	const { viem, getNamedAccounts, network } = hre
	const { deployer } = await getNamedAccounts()
	const publicClient = await viem.getPublicClient()

	const account = privateKeyToAccount(
		`0x${process.env.DEPLOYER_WALLET_PRIVATE_KEY}` as Hex
	)
	const walletClient = createWalletClient({
		account,
		chain: sepolia,
		transport: http(process.env.ETHEREUM_SEPOLIA_RPC_HTTPS)
	})

	console.log('----------------------------------------------------')
	console.log(`Network: ${network.name}`)
	console.log(`Seeding pools with ~$500 per side`)

	const pairs = ['DAI', 'USDC', 'LINK', 'WBTC', 'WSTETH'] as const
	for (const sym of pairs) {
		const token = ADDR[sym] as Address
		const pyusd = ADDR.PYUSD as Address

		// Precios 1e8
		const pxToken1e8 = await usd1e8For(sym as any, publicClient)
		const pxPyusd1e8 = ONE_E8

		// Cantidades target (exactas) para $500 por lado
		const amtTokenExact =
			(USD_SIDE_1E8 * 10n ** BigInt(DECIMALS[sym])) / pxToken1e8
		const amtPyusdExact =
			(USD_SIDE_1E8 * 10n ** BigInt(DECIMALS.PYUSD)) / pxPyusd1e8

		// Max con buffer 1%
		const buf = 10_000n + SLIP_BPS
		const amtTokenMax = (amtTokenExact * buf) / 10_000n
		const amtPyusdMax = (amtPyusdExact * buf) / 10_000n

		// Orden currency0 < currency1
		let a: Address = pyusd,
			b: Address = token
		if (a.toLowerCase() > b.toLowerCase()) {
			const t = a
			a = b
			b = t
		}

		// sqrtPriceX96 (p = token1/token0)
		let num = pxPyusd1e8,
			den = pxToken1e8
		if (a.toLowerCase() === pyusd.toLowerCase()) {
			num = pxToken1e8
			den = pxPyusd1e8
		} else {
			num = pxPyusd1e8
			den = pxToken1e8
		}
		const radicand = (num * Q96 * Q96) / den
		const sqrtPriceX96 = isqrt(radicand)

		// 1) initialize pool (ignora si ya existe)
		try {
			const tx0 = await walletClient.writeContract({
				address: POOL_MANAGER,
				abi: poolManagerAbi,
				functionName: 'initialize',
				args: [
					{
						currency0: a,
						currency1: b,
						fee: FEE,
						tickSpacing: TICK_SPACING,
						hooks: zeroAddress
					},
					sqrtPriceX96
				],
				account
			})
			await publicClient.waitForTransactionReceipt({ hash: tx0 })
			console.log(`✅ initialize ${sym}/PYUSD tx: ${tx0}`)
		} catch (e: any) {
			console.log(
				`ℹ️ init skipped (${sym}/PYUSD): ${e?.shortMessage || e?.message || e}`
			)
		}

		// token0/token1 según orden
		const token0 = a,
			token1 = b
		const amt0Max =
			token0.toLowerCase() === pyusd.toLowerCase()
				? amtPyusdMax
				: token0.toLowerCase() === token.toLowerCase()
					? amtTokenMax
					: 0n
		const amt1Max =
			token1.toLowerCase() === pyusd.toLowerCase()
				? amtPyusdMax
				: token1.toLowerCase() === token.toLowerCase()
					? amtTokenMax
					: 0n

		// 2) approvals: ERC20->Permit2 y luego Permit2->PositionManager
		for (const tkn of [token0, token1]) {
			const h1 = await walletClient.writeContract({
				address: tkn,
				abi: IERC20_ABI,
				functionName: 'approve',
				args: [PERMIT2, AMOUNT_MAX],
				account
			})
			await publicClient.waitForTransactionReceipt({ hash: h1 })
		}
		for (const tkn of [token0, token1]) {
			const h2 = await walletClient.writeContract({
				address: PERMIT2,
				abi: permit2Abi,
				functionName: 'approve',
				args: [tkn, POSITION_MANAGER, AMOUNT_MAX, (1n << 48n) - 1n],
				account
			})
			await publicClient.waitForTransactionReceipt({ hash: h2 })
		}

		// 3) MINT_POSITION + SETTLE_PAIR vía multicall
		const actions = toHex(
			new Uint8Array([Actions.MINT_POSITION, Actions.SETTLE_PAIR])
		)
		const deadline = Math.floor(Date.now() / 1000) + 120
		const recipient = (await getNamedAccounts()).deployer as Address

		const mintParams = [
			encodeAbiParameters(
				[
					{
						type: 'tuple',
						components: [
							{ name: 'currency0', type: 'address' },
							{ name: 'currency1', type: 'address' },
							{ name: 'fee', type: 'uint24' },
							{ name: 'tickSpacing', type: 'int24' },
							{ name: 'hooks', type: 'address' }
						]
					},
					{ type: 'int24' },
					{ type: 'int24' },
					{ type: 'uint256' }, // liquidity
					{ type: 'uint128' }, // amount0Max
					{ type: 'uint128' }, // amount1Max
					{ type: 'address' },
					{ type: 'bytes' }
				],
				[
					{
						currency0: token0,
						currency1: token1,
						fee: FEE,
						tickSpacing: TICK_SPACING,
						hooks: zeroAddress
					},
					TICK_LOWER,
					TICK_UPPER,
					LIQUIDITY,
					amt0Max,
					amt1Max,
					recipient,
					HOOK_DATA
				]
			),
			encodeAbiParameters(
				[{ type: 'address' }, { type: 'address' }],
				[token0, token1]
			)
		]

		const modifyData = encodeFunctionData({
			abi: positionManagerAbi as any,
			functionName: 'modifyLiquidities',
			args: [
				encodeAbiParameters(
					[{ type: 'bytes' }, { type: 'bytes[]' }],
					[actions, mintParams]
				),
				deadline
			]
		})

		const tx1 = await walletClient.writeContract({
			address: POSITION_MANAGER,
			abi: positionManagerAbi as any,
			functionName: 'multicall',
			args: [[modifyData]],
			account
		})
		await publicClient.waitForTransactionReceipt({ hash: tx1 })

		console.log('----------------------------------------------------')
		console.log(`💧 Seeded ${sym}/PYUSD with ~$500 + ~$500. Tx: ${tx1}`)
		console.log(` token0=${token0} amount0Max=${amt0Max.toString()}`)
		console.log(` token1=${token1} amount1Max=${amt1Max.toString()}`)
	}

	console.log('✅ Done.')
})

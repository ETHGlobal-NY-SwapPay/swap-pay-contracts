import { task } from 'hardhat/config'
import {
	createWalletClient,
	encodeAbiParameters,
	encodeFunctionData,
	Hex,
	http,
	toHex
} from 'viem'
import { Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

import {
	Actions,
	FEE,
	HOOKS,
	IERC20_ABI,
	PERMIT2_ADDRESS,
	POSITION_MANAGER_ADDRESS,
	TICKSPACING
} from '@/config/const'

import permit2Abi from '../assets/abis/Permit2.json'
import positionManagerAbi from '../assets/abis/PositionManager.json'

task('add-liquidity', 'Adds liquidity to pool')
	.addParam('symbol1', 'The token symbol (e.g. DAI, USDC, WBTC, LINK, WSTETH)')
	.addParam('symbol2', 'The token symbol (e.g. DAI, USDC, WBTC, LINK, WSTETH)')
	.setAction(async ({ symbol1, symbol2 }, hre) => {
		try {
			const { viem, deployments, getNamedAccounts } = hre
			const { deployer } = await getNamedAccounts()

			const account = privateKeyToAccount(
				`0x${process.env.DEPLOYER_WALLET_PRIVATE_KEY}` as Hex
			)

			const publicClient = await viem.getPublicClient()
			const walletClient = createWalletClient({
				account,
				chain: sepolia,
				transport: http(process.env.ETHEREUM_SEPOLIA_RPC_HTTPS)
			})

			const symbol1Upper = symbol1.toUpperCase()
			const symbol2Upper = symbol2.toUpperCase()

			const { address: daiAddress } = (await deployments.get('DAI')) as {
				address: Address
			}

			const { address: usdcAddress } = (await deployments.get('USDC')) as {
				address: Address
			}

			const poolKey = {
				currency0: usdcAddress,
				currency1: daiAddress,
				fee: FEE,
				tickSpacing: TICKSPACING,
				hooks: HOOKS
			}

			const tickLower = -887220
			const tickUpper = 887220

			const amount0Max = 10n * 10n ** 6n
			const amount1Max = 10n * 10n ** 18n
			const liquidity = 1_000_000n

			const recipient = deployer as Address
			const hookData = '0x'

			const amountMax = (1n << 160n) - 1n

			console.log('----------------------------------------------------')
			console.log(`💧 Adding liquidity to ${symbol1Upper} / ${symbol2Upper}...`)

			for (const token of [daiAddress, usdcAddress]) {
				const hash = await walletClient.writeContract({
					address: token as Address,
					abi: IERC20_ABI,
					functionName: 'approve',
					args: [PERMIT2_ADDRESS, amountMax],
					account
				})

				await publicClient.waitForTransactionReceipt({ hash })

				console.log(`approve(${token}) tx hash: ${hash}`)
			}

			for (const token of [daiAddress, usdcAddress]) {
				const hash = await walletClient.writeContract({
					address: PERMIT2_ADDRESS,
					abi: permit2Abi,
					functionName: 'approve',
					args: [
						token as Address,
						POSITION_MANAGER_ADDRESS,
						amountMax,
						BigInt(2) ** 48n - 1n
					],
					account
				})
				console.log(`permit2.approve(${token}). tx hash: ${hash}`)
				await publicClient.waitForTransactionReceipt({ hash })
			}

			const actions = toHex(
				new Uint8Array([Actions.MINT_POSITION, Actions.SETTLE_PAIR])
			)

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
						{ type: 'uint256' },
						{ type: 'uint128' },
						{ type: 'uint128' },
						{ type: 'address' },
						{ type: 'bytes' }
					],
					[
						poolKey,
						tickLower,
						tickUpper,
						liquidity,
						amount0Max,
						amount1Max,
						recipient,
						hookData
					]
				),
				encodeAbiParameters(
					[{ type: 'address' }, { type: 'address' }],
					[poolKey.currency0, poolKey.currency1]
				)
			]

			const deadline = Math.floor(Date.now() / 1000) + 60

			const hash = await walletClient.writeContract({
				address: POSITION_MANAGER_ADDRESS,
				abi: positionManagerAbi,
				functionName: 'multicall',
				args: [
					[
						encodeFunctionData({
							abi: positionManagerAbi,
							functionName: 'modifyLiquidities',
							args: [
								encodeAbiParameters(
									[{ type: 'bytes' }, { type: 'bytes[]' }],
									[actions, mintParams]
								),
								deadline
							]
						})
					]
				],
				account
			})

			await publicClient.waitForTransactionReceipt({ hash })

			console.log(`✅ Liquidity added! tx hash: ${hash}`)
		} catch (error) {
			console.error('❌ Error adding liquidity:', error)
		}
	})

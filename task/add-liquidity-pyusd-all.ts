// tasks/add-liquidity-pyusd-all.ts
import { task } from 'hardhat/config'
import type { Address } from 'viem'
import {
	createWalletClient,
	decodeErrorResult,
	encodeAbiParameters,
	encodeFunctionData,
	Hex,
	http,
	toHex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

import permit2Abi from '@/assets/abis/Permit2.json'
// opcional si lo usas para checks extra
import positionManagerAbi from '@/assets/abis/PositionManager.json'
import {
	Actions,
	AMOUNT_MAX_ERC20,
	FEE,
	HOOKS,
	IERC20_ABI,
	LIQUIDITY,
	PERMIT2_ADDRESS,
	PERMIT2_EXPIRATION,
	POSITION_MANAGER_ADDRESS,
	TICK_LOWER,
	TICK_UPPER,
	TICKSPACING,
	tokenDecimals,
	UINT128_MAX
} from '@/config/const'

task(
	'add-liquidity-pyusd-all',
	'Adds the same liquidity to every PYUSD/* pool that exists; skips missing/uninitialized pools.'
).setAction(async (_, hre) => {
	try {
		const { viem, deployments, getNamedAccounts } = hre
		const { deployer } = (await getNamedAccounts()) as { deployer: Address }

		const account = privateKeyToAccount(
			`0x${process.env.DEPLOYER_WALLET_PRIVATE_KEY}` as Hex
		)

		const publicClient = await viem.getPublicClient()
		const walletClient = createWalletClient({
			account,
			chain: sepolia,
			transport: http(process.env.ETHEREUM_SEPOLIA_RPC_HTTPS)
		})

		const { address: pyusd } = (await deployments.get('PYUSD')) as {
			address: Address
		}

		const symbols = Object.keys(tokenDecimals)
			.map(s => s.toUpperCase())
			.filter(s => s !== 'PYUSD')

		const tokenAddrs: Address[] = []
		tokenAddrs.push(pyusd)
		for (const sym of symbols) {
			try {
				const { address } = (await deployments.get(sym)) as { address: Address }
				tokenAddrs.push(address)
			} catch (e) {
				console.warn(
					`⚠️  No deployment para ${sym}. Saltando sus aportes de liquidez.`
				)
			}
		}

		console.log('----------------------------------------------------')
		console.log('🪙 Approving ERC20 -> Permit2 (once per token)...')
		for (const token of unique(tokenAddrs)) {
			try {
				const hash = await walletClient.writeContract({
					address: token,
					abi: IERC20_ABI,
					functionName: 'approve',
					args: [PERMIT2_ADDRESS, AMOUNT_MAX_ERC20],
					account
				})
				await publicClient.waitForTransactionReceipt({ hash })
				console.log(`✅ approve(ERC20→Permit2) ${token} tx: ${hash}`)
			} catch (err: any) {
				console.warn(
					`⚠️  approve(ERC20→Permit2) falló en ${token}: ${err?.shortMessage ?? err?.message ?? err}`
				)
			}
		}

		// Permit2 -> PositionManager (una sola vez por token)
		console.log('----------------------------------------------------')
		console.log('📜 Permit2.approve -> PositionManager (once per token)...')
		for (const token of unique(tokenAddrs)) {
			try {
				const hash = await walletClient.writeContract({
					address: PERMIT2_ADDRESS,
					abi: permit2Abi,
					functionName: 'approve',
					args: [
						token,
						POSITION_MANAGER_ADDRESS,
						AMOUNT_MAX_ERC20,
						PERMIT2_EXPIRATION
					],
					account
				})
				await publicClient.waitForTransactionReceipt({ hash })
				console.log(`✅ permit2.approve(${token}) tx: ${hash}`)
			} catch (err: any) {
				console.warn(
					`⚠️  permit2.approve falló en ${token}: ${err?.shortMessage ?? err?.message ?? err}`
				)
			}
		}

		// Por cada par PYUSD / token, intenta añadir liquidez
		console.log('----------------------------------------------------')
		console.log(
			`💧 Adding liquidity (same LIQUIDITY=${LIQUIDITY}) to PYUSD pairs: ${symbols.join(', ')}`
		)

		for (const sym of symbols) {
			let other: Address
			try {
				other = (await deployments.get(sym)).address as Address
			} catch {
				console.warn(`⚠️  Omitiendo ${sym} (sin deployment).`)
				continue
			}

			// currency0 / currency1 por orden lexicográfico de address
			const [currency0, currency1] =
				other.toLowerCase() < pyusd.toLowerCase()
					? ([other, pyusd] as [Address, Address])
					: ([pyusd, other] as [Address, Address])

			const poolKey = {
				currency0,
				currency1,
				fee: FEE,
				tickSpacing: TICKSPACING,
				hooks: HOOKS
			}

			// amount0/1 máximos (permiten que el PM consuma lo necesario para la LIQUIDITY deseada)
			// Si prefieres límites, cámbialos por valores en base a decimales.
			const amount0Max = UINT128_MAX
			const amount1Max = UINT128_MAX

			// acciones: Mint + SettlePair
			const actions = toHex(
				new Uint8Array([Actions.MINT_POSITION, Actions.SETTLE_PAIR])
			)

			// payloads
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
						{ type: 'int24' }, // tickLower
						{ type: 'int24' }, // tickUpper
						{ type: 'uint256' }, // liquidity (note: PositionManager usa uint256 para liquidity param)
						{ type: 'uint128' }, // amount0Max
						{ type: 'uint128' }, // amount1Max
						{ type: 'address' }, // recipient
						{ type: 'bytes' } // hookData
					],
					[
						poolKey,
						TICK_LOWER,
						TICK_UPPER,
						LIQUIDITY,
						amount0Max,
						amount1Max,
						deployer,
						'0x'
					]
				),
				encodeAbiParameters(
					[{ type: 'address' }, { type: 'address' }],
					[poolKey.currency0, poolKey.currency1]
				)
			]

			const deadline = Math.floor(Date.now() / 1000) + 60

			// Simular antes para saltar pools no inicializadas u otros errores
			try {
				await publicClient.simulateContract({
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
			} catch (simErr: any) {
				// Intenta decodificar el nombre del error
				const decodedName = safeDecodeError(
					simErr?.data as Hex,
					positionManagerAbi
				)
				const msg =
					decodedName ||
					simErr?.shortMessage ||
					simErr?.message ||
					String(simErr)
				console.warn(`⚠️  simulate ${symbolPair(pyusd, other)} revert: ${msg}`)
				// Si la razón es "pool no inicializada" o similar, saltamos:
				if (
					/NotInitialized|Uninitialized|PoolNotInitialized|initialized required/i.test(
						msg
					)
				) {
					console.log(
						`ℹ️  Pool ${symbolPair(pyusd, other)} no está inicializada. Saltando.`
					)
					continue
				}
				// Otros errores: puedes continuar para “intentar igual”, pero lo más sano es saltar.
				console.log(
					`ℹ️  Saltando ${symbolPair(pyusd, other)} por error en simulación.`
				)
				continue
			}

			// Si la simulación pasó, enviamos la tx
			try {
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
				console.log(
					`✅ Liquidity added to ${symbolPair(pyusd, other)}. tx: ${hash}`
				)
			} catch (writeErr: any) {
				const decodedName = safeDecodeError(
					writeErr?.data as Hex,
					positionManagerAbi
				)
				const msg =
					decodedName ||
					writeErr?.shortMessage ||
					writeErr?.message ||
					String(writeErr)
				console.error(`❌ write ${symbolPair(pyusd, other)} revert: ${msg}`)
			}
		}

		console.log('----------------------------------------------------')
		console.log('🎉 Done adding liquidity to all PYUSD pairs.')
	} catch (error) {
		console.error('❌ Error in add-liquidity-pyusd-all:', error)
	}
})

// Helpers
function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)]
}

function symbolPair(pyusdAddr: Address, otherAddr: Address) {
	// Solo para logs bonitos: PYUSD/XXX según orden lexicográfico de address
	return otherAddr.toLowerCase() < pyusdAddr.toLowerCase()
		? `(${otherAddr}) / (PYUSD ${pyusdAddr})`
		: `(PYUSD ${pyusdAddr}) / (${otherAddr})`
}

function safeDecodeError(data: Hex | undefined, abi: any): string | undefined {
	if (!data) return
	try {
		const decoded = decodeErrorResult({ abi, data })
		return decoded?.errorName
	} catch {
		return
	}
}

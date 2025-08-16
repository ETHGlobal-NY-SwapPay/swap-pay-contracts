import { task } from 'hardhat/config'
import type { Address } from 'viem'
import { decodeErrorResult, Hex } from 'viem'

import poolManagerAbi from '@/assets/abis/PoolManager.json'
import {
	FEE,
	HOOKS,
	ONE_TO_ONE_SQRT_PRICE_X96,
	POOL_MANAGER_ADDRESS,
	TICKSPACING,
	tokenDecimals
} from '@/config/const'

const ALREADY_INIT_REGEX =
	/AlreadyInitialized|already initialized|already exists|Initialized/i

task(
	'create-pyusd-pools',
	'Creates PYUSD/* pools for all tokens in tokenDecimals (except PYUSD). Skips if already initialized.'
).setAction(async (_, hre) => {
	try {
		const { viem, deployments, getNamedAccounts } = hre
		const { deployer } = (await getNamedAccounts()) as { deployer: Address }

		const publicClient = await viem.getPublicClient()
		const walletClient = await viem.getWalletClient(deployer)

		const { address: pyusdAddress } = (await deployments.get('PYUSD')) as {
			address: Address
		}

		const symbols = Object.keys(tokenDecimals).filter(
			s => s.toUpperCase() !== 'PYUSD'
		)

		console.log('----------------------------------------------------')
		console.log(`🏊 Creating pools for PYUSD against: ${symbols.join(', ')}`)

		for (const rawSymbol of symbols) {
			const symbol = rawSymbol.toUpperCase()

			try {
				const { address: otherTokenAddress } = (await deployments.get(
					symbol
				)) as {
					address: Address
				}

				let currency0: Address
				let currency1: Address
				const sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96

				if (otherTokenAddress.toLowerCase() < pyusdAddress.toLowerCase()) {
					currency0 = otherTokenAddress
					currency1 = pyusdAddress
				} else {
					currency0 = pyusdAddress
					currency1 = otherTokenAddress
				}

				let canProceed = true
				try {
					await publicClient.simulateContract({
						address: POOL_MANAGER_ADDRESS,
						abi: poolManagerAbi,
						functionName: 'initialize',
						args: [
							{
								currency0,
								currency1,
								fee: FEE,
								tickSpacing: TICKSPACING,
								hooks: HOOKS
							},
							sqrtPriceX96
						],
						account: deployer
					})
				} catch (simErr: any) {
					const data: Hex | undefined = simErr?.data
					let decodedName: string | undefined
					try {
						if (data) {
							const decoded = decodeErrorResult({
								abi: poolManagerAbi as any,
								data
							})
							decodedName = decoded?.errorName
						}
					} catch {
						// ignore decode failure
					}

					const msg =
						decodedName ??
						simErr?.shortMessage ??
						simErr?.message ??
						(typeof simErr === 'string' ? simErr : '')

					if (decodedName) {
						console.warn(`⚠️  simulate revert: ${decodedName}`)
					} else {
						console.warn(`⚠️  simulate revert (raw): ${msg}`)
					}

					if (decodedName && ALREADY_INIT_REGEX.test(decodedName)) {
						console.log(`ℹ️  Pool PYUSD / ${symbol} already initialized.`)
						canProceed = false
					} else if (ALREADY_INIT_REGEX.test(msg)) {
						console.log(
							`ℹ️  Pool PYUSD / ${symbol} already exists (by message). Skipping.`
						)
						canProceed = false
					} else {
						console.warn(
							`⚠️  Simulation failed for another reason (not "already exists"). Trying write may still fail.`
						)
					}
				}

				if (!canProceed) continue

				const hash = await walletClient.writeContract({
					address: POOL_MANAGER_ADDRESS,
					abi: poolManagerAbi,
					functionName: 'initialize',
					args: [
						{
							currency0,
							currency1,
							fee: FEE,
							tickSpacing: TICKSPACING,
							hooks: HOOKS
						},
						sqrtPriceX96
					],
					account: deployer
				})

				await publicClient.waitForTransactionReceipt({ hash })
				console.log(`✅ Pool PYUSD / ${symbol} created. Tx: ${hash}`)
			} catch (innerErr: any) {
				const data: Hex | undefined = innerErr?.data
				let decodedName: string | undefined
				try {
					if (data) {
						const decoded = decodeErrorResult({
							abi: poolManagerAbi as any,
							data
						})
						decodedName = decoded?.errorName
					}
				} catch {
					// ignore decode failure
				}

				const msg =
					decodedName ??
					innerErr?.shortMessage ??
					innerErr?.message ??
					String(innerErr)

				if (decodedName) {
					console.error(`❌ write revert (${symbol}): ${decodedName}`)
				} else {
					console.error(`❌ write revert (${symbol}) (raw): ${msg}`)
				}

				if (decodedName && ALREADY_INIT_REGEX.test(decodedName)) {
					console.log(
						`ℹ️  Pool PYUSD / ${symbol} already initialized. Skipping.`
					)
				} else if (ALREADY_INIT_REGEX.test(msg)) {
					console.log(
						`ℹ️  Pool PYUSD / ${symbol} already exists (by message). Skipping.`
					)
				} else {
					console.error(`❌ write revert (${symbol}) (raw): ${msg}`)
				}
			}
		}
	} catch (error) {
		console.error('❌ Error creating PYUSD/* pools:', error)
	}
})

import { task } from 'hardhat/config'
import type { Address } from 'viem'

import poolManagerAbi from '@/assets/abis/PoolManager.json'
import {
	FEE,
	HOOKS,
	ONE_TO_ONE_SQRT_PRICE_X96,
	POOL_MANAGER_ADDRESS,
	TICKSPACING
} from '@/config/const'

task('create-pool', 'Creates a pool between two tokens')
	.addParam('symbol1', 'The token symbol (e.g. DAI, USDC, WBTC, LINK, WSTETH)')
	.addParam('symbol2', 'The token symbol (e.g. DAI, USDC, WBTC, LINK, WSTETH)')
	.setAction(async ({ symbol1, symbol2 }, hre) => {
		try {
			const { viem, deployments, getNamedAccounts } = hre
			const { deployer } = (await getNamedAccounts()) as { deployer: Address }

			const publicClient = await viem.getPublicClient()
			const walletClient = await viem.getWalletClient(deployer)

			const symbol1Upper = symbol1.toUpperCase()
			const symbol2Upper = symbol2.toUpperCase()

			const { address: daiAddress } = (await deployments.get(symbol1Upper)) as {
				address: Address
			}

			const { address: usdcAddress } = (await deployments.get(
				symbol2Upper
			)) as {
				address: Address
			}

			let currency0: Address
			let currency1: Address
			let sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96

			if (usdcAddress.toLowerCase() < daiAddress.toLowerCase()) {
				currency0 = usdcAddress
				currency1 = daiAddress
				sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96
			} else {
				currency0 = daiAddress
				currency1 = usdcAddress
				sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96
			}

			console.log('----------------------------------------------------')
			console.log(
				`🏊 Creating pool ${symbol1Upper} / ${symbol2Upper} via PoolManager.initialize...`
			)

			const hash = await walletClient.writeContract({
				address: POOL_MANAGER_ADDRESS,
				abi: poolManagerAbi,
				functionName: 'initialize',
				args: [{ currency0, currency1, FEE, TICKSPACING, HOOKS }, sqrtPriceX96],
				account: deployer
			})

			await publicClient.waitForTransactionReceipt({ hash })

			console.log(`✅ Pool created. Tx: ${hash}`)
		} catch (error) {
			console.error('❌ Error creating pool:', error)
		}
	})

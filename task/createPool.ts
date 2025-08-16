import { task } from 'hardhat/config'
import type { Address } from 'viem'
import { zeroAddress } from 'viem'

import poolManagerAbi from '@/assets/abis/PoolManager.json'

/**
 * sqrtPriceX96 para precio p = token1/token0
 * p = 1  => 2^96
 */
const Q96 = 2n ** 96n
const ONE_TO_ONE_SQRT_PRICE_X96 = Q96 // 79228162514264337593543950336n

task(
	'create-pool',
	'Creates a USDC/DAI pool on Sepolia using PoolManager'
).setAction(async (_, hre) => {
	try {
		const { viem, deployments, getNamedAccounts } = hre
		const { deployer } = (await getNamedAccounts()) as { deployer: Address }

		const publicClient = await viem.getPublicClient()
		const walletClient = await viem.getWalletClient(deployer)

		// ⚠️ Confirma que estos deployments existen en tu hardhat-deploy
		const { address: dai } = (await deployments.get('DAI')) as {
			address: Address
		}
		const { address: usdc } = (await deployments.get('USDC')) as {
			address: Address
		}

		let currency0: Address
		let currency1: Address
		let sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96

		if (usdc.toLowerCase() < dai.toLowerCase()) {
			currency0 = usdc
			currency1 = dai
			sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96
		} else {
			currency0 = dai
			currency1 = usdc
			sqrtPriceX96 = ONE_TO_ONE_SQRT_PRICE_X96
		}

		const fee = 3000 // 0.30%
		const tickSpacing = 60
		const hooks = zeroAddress

		console.log('----------------------------------------------------')
		console.log(
			`🏊 Creating pool ${currency0} / ${currency1} via PoolManager.initialize...`
		)

		const initializeTx = await walletClient.writeContract({
			address: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
			abi: poolManagerAbi,
			functionName: 'initialize',
			args: [{ currency0, currency1, fee, tickSpacing, hooks }, sqrtPriceX96],
			account: deployer
		})

		await publicClient.waitForTransactionReceipt({ hash: initializeTx })

		console.log(`✅ Pool created! Tx: ${initializeTx}`)
	} catch (error) {
		console.error('❌ Error creating pool:', error)
	}
})

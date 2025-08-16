import { task } from 'hardhat/config'
import { Address } from 'viem'

import { tokenDecimals } from '@/models'

task('faucet', 'Mints tokens from the specified token contract')
	.addParam('symbol', 'The token symbol (e.g. DAI, USDC, WBTC, LINK, WSTETH)')
	.addParam('amount', 'Amount to mint (integer, without decimals)')
	.addParam('to', 'Recipient address')
	.setAction(async ({ symbol, amount, to }, hre) => {
		try {
			const { viem } = hre
			const { getNamedAccounts, deployments } = hre
			const { deployer } = await getNamedAccounts()

			const publicClient = await viem.getPublicClient()

			const symbolUpper = symbol.toUpperCase()
			const decimals = tokenDecimals[symbolUpper]
			const tokenAmount = BigInt(amount) * BigInt(10 ** decimals)

			if (decimals === undefined) {
				throw new Error(`Token symbol ${symbolUpper} is not recognized.`)
			}

			console.log('----------------------------------------------------')
			console.log(`💰 Minting ${amount} ${symbolUpper} to ${to}`)

			const { address } = (await deployments.get(symbolUpper)) as {
				address: Address
			}
			const token = await viem.getContractAt(symbolUpper, address)

			const hash = await token.write.mint([to, tokenAmount], {
				account: deployer
			})

			await publicClient.waitForTransactionReceipt({
				hash
			})

			console.log(`✅ Minted. tx hash: ${hash}`)
		} catch (error) {
			console.error('❌ Error minting tokens:', error)
		}
	})

import { task } from 'hardhat/config'
import { encodeFunctionData, Hex } from 'viem'
import { Address } from 'viem'

import { tokenDecimals } from '@/config/const'

task('mint-tokens', 'Mints tokens using Multicall3')
	.addParam('amount', 'Amount to mint (human-readable units)')
	.addParam('to', 'Recipient address')
	.setAction(async ({ amount, to }, hre) => {
		try {
			const { getNamedAccounts, viem, deployments } = hre
			const { deployer } = await getNamedAccounts()

			const publicClient = await viem.getPublicClient()

			const calls: {
				target: Address
				allowFailure: boolean
				callData: Hex
			}[] = []

			for (const symbol of Object.keys(tokenDecimals)) {
				const decimals = tokenDecimals[symbol]
				const tokenAmount = BigInt(amount) * BigInt(10 ** decimals)

				const { address: tokenAddress } = (await deployments.get(symbol)) as {
					address: Address
				}

				const token = await viem.getContractAt(symbol, tokenAddress)

				const callData = encodeFunctionData({
					abi: token.abi,
					functionName: 'mint',
					args: [to as Address, tokenAmount]
				})

				calls.push({
					target: tokenAddress as Address,
					allowFailure: false,
					callData
				})
			}

			const { address: multicallAddress } = (await deployments.get(
				'Multicall3'
			)) as {
				address: Address
			}

			const multicall3 = await viem.getContractAt(
				'Multicall3',
				multicallAddress
			)

			const hash = await multicall3.write.aggregate3([calls], {
				account: deployer as Address
			})

			console.log('----------------------------------------------------')
			console.log(
				`💰 Minting ${amount} tokens of ${Object.keys(tokenDecimals).join(', ')} to ${to} via Multicall3...`
			)
			await publicClient.waitForTransactionReceipt({ hash })

			console.log(`✅ Minted tokens. Tx: ${hash}`)
		} catch (error) {
			console.error('❌ Error minting tokens:', error)
		}
	})

import { task } from 'hardhat/config'
import type { Address } from 'viem'
import { encodeFunctionData, Hex } from 'viem'

import { tokenDecimals } from '@/config/const'

task('approve-tokens', 'Approves ERC20 allowances via Multicall3')
	.addParam('amount', 'Amount to approve (human-readable units)')
	.addParam('spender', 'Spender address to approve')
	.setAction(async ({ amount, spender }, hre) => {
		try {
			const { getNamedAccounts, viem, deployments } = hre
			const { deployer } = await getNamedAccounts()
			const publicClient = await viem.getPublicClient()

			const calls: { target: Address; allowFailure: boolean; callData: Hex }[] =
				[]

			for (const symbol of Object.keys(tokenDecimals)) {
				const decimals = tokenDecimals[symbol]
				const tokenAmount = BigInt(amount) * 10n ** BigInt(decimals)

				const { address: tokenAddress } = (await deployments.get(symbol)) as {
					address: Address
				}
				const token = await viem.getContractAt(symbol, tokenAddress)

				const callData = encodeFunctionData({
					abi: token.abi,
					functionName: 'approve',
					args: [spender as Address, tokenAmount]
				})

				calls.push({
					target: tokenAddress as Address,
					allowFailure: false,
					callData
				})
			}

			const { address: multicallAddress } = (await deployments.get(
				'Multicall3'
			)) as { address: Address }
			const multicall3 = await viem.getContractAt(
				'Multicall3',
				multicallAddress
			)

			console.log('----------------------------------------------------')
			console.log(
				`📝 Approving ${amount} for ${Object.keys(tokenDecimals).join(', ')} to ${spender} via Multicall3...`
			)

			// 👇 pasar args como [calls]
			const hash = await multicall3.write.aggregate3([calls], {
				account: deployer as Address
			})

			await publicClient.waitForTransactionReceipt({ hash })
			console.log(`✅ Approved allowances. Tx: ${hash}`)
		} catch (error) {
			console.error('❌ Error approving tokens:', error)
		}
	})

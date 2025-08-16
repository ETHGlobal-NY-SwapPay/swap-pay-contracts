import { run } from 'hardhat'

export async function verify(
	contractAddress: string,
	args: unknown[]
): Promise<void> {
	console.log('Verifying contract...')

	try {
		await run('verify:verify', {
			address: contractAddress,
			constructorArguments: args
		})

		console.log('✅ Contract verified successfully!')
	} catch (error: any) {
		if (error.message.toLowerCase().includes('already verified')) {
			console.log('✅ Contract is already verified!')
		} else {
			console.error('❌ Verification error:', error.message)
		}
	}
}

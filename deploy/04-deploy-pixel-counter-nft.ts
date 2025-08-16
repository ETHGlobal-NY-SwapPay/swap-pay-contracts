import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Address } from 'viem'

import { developmentChains, networkConfig } from '@/config/const'
import { verify } from '@/utils/verify'

const deployPixelCounterNft: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { viem, getNamedAccounts, deployments, network } = hre
	const { deploy, log } = deployments
	const { deployer } = (await getNamedAccounts()) as { deployer: Address }

	const publicClient = await viem.getPublicClient()
	const walletClient = await viem.getWalletClient(deployer)

	log('----------------------------------------------------')
	log('Deploying PixelCounterNFT and waiting for confirmations...')

	const price = 30_000_000 // 6 PYUSDs

	const args: string[] = [price.toString()]

	const pixelCounterNFT = await deploy('PixelCounterNFT', {
		from: deployer,
		args,
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`PixelCounterNFT deployed at ${pixelCounterNFT.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(pixelCounterNFT.address, args)
	}

	log('----------------------------------------------------')
	log('Setting up PixelCounterNFT...')
	log('adding supported tokens...')

	const { address: pyusdAddress } = (await deployments.get('PYUSD')) as {
		address: Address
	}

	const pixelCounterNftContract = await viem.getContractAt(
		'PixelCounterNFT',
		pixelCounterNFT.address as Address,
		{ client: { wallet: walletClient } }
	)

	const hash = await pixelCounterNftContract.write.addToToken([pyusdAddress])

	await publicClient.waitForTransactionReceipt({ hash })

	console.log(`✅ Added PYUSD to PixelCounterNFT. Tx: ${hash}`)
}

export default deployPixelCounterNft
deployPixelCounterNft.tags = ['deploy', 'pixelCounterNFT']

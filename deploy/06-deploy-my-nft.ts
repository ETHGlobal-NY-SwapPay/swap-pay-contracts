import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Address } from 'viem'

import { developmentChains, networkConfig } from '@/config/const'
import { verify } from '@/utils/verify'

const deployMyNft: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { getNamedAccounts, deployments, network } = hre
	const { deploy, log } = deployments
	const { deployer } = (await getNamedAccounts()) as { deployer: Address }

	log('----------------------------------------------------')
	log('Deploying MyNft and waiting for confirmations...')

	const { address: pyusdAddress } = (await deployments.get('PYUSD')) as {
		address: Address
	}

	const price = 52_000_000_000 // 6 PYUSDs

	const args: string[] = [price.toString(), pyusdAddress]

	const myNft = await deploy('MyNft', {
		from: deployer,
		args,
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`MyNft deployed at ${myNft.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(myNft.address, args)
	}
}

export default deployMyNft
deployMyNft.tags = ['deploy', 'myNft']

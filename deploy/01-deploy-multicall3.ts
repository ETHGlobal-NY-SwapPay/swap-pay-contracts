import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

import { developmentChains, networkConfig } from '@/config/const'
import { verify } from '@/utils/verify'

const deployMulticall3: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { getNamedAccounts, deployments, network } = hre
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()

	log('----------------------------------------------------')
	log('Deploying Multicall3 and waiting for confirmations...')

	const args: string[] = []

	const multicall3 = await deploy('Multicall3', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`Multicall3 deployed at ${multicall3.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(multicall3.address, args)
	}
}

export default deployMulticall3
deployMulticall3.tags = ['deploy', 'multicall3']

import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

import { developmentChains, networkConfig } from '@/config/const'
import { verify } from '@/utils/verify'

const deployTokens: DeployFunction = async function (
	hre: HardhatRuntimeEnvironment
) {
	const { getNamedAccounts, deployments, network } = hre
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()

	log('----------------------------------------------------')
	log('Deploying Tokens and waiting for confirmations...')

	const args: string[] = []

	const DAI = await deploy('DAI', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`DAI deployed at ${DAI.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(DAI.address, args)
	}

	const LINK = await deploy('LINK', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	const PYUSD = await deploy('PYUSD', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`PYUSD deployed at ${PYUSD.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(PYUSD.address, args)
	}

	log(`LINK deployed at ${LINK.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(LINK.address, args)
	}

	const USDC = await deploy('USDC', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`USDC deployed at ${USDC.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(USDC.address, args)
	}

	const WBTC = await deploy('WBTC', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`WBTC deployed at ${WBTC.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(WBTC.address, args)
	}

	const WSTETH = await deploy('WSTETH', {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`WSTETH deployed at ${WSTETH.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(WSTETH.address, args)
	}
}

export default deployTokens
deployTokens.tags = ['deploy', 'tokens']

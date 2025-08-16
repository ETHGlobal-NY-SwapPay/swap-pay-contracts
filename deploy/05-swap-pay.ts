// deploy/02_deploy_feeds.ts
import { Address } from 'abitype'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

import {
	developmentChains,
	networkConfig,
	POOL_MANAGER_ADDRESS,
	POOL_TEST_SWAP_ADDRESS
} from '@/config/const'
import { verify } from '@/utils/verify'

const addresses = {
	// TOKENS (IERC20)
	WBTC: '0xBf4ED0f867CFf7af2acFa4F727ef43EB89C4C195',
	DAI: '0x5aBa799fFDFc52785EFC073E11D4671a4186F3d8',
	USDC: '0xdC02992BD2700966775fDDd9ee1d8758B3Af24C5',
	LINK: '0xd76ff4D27F5D56e24B3764e08Ffd7052006B10B1',
	WSTETH: '0x33e3BDE50A20946FFb2e2f2C6A9C4Cb291A90cfE',
	PYUSD: '0xE448eAbd8420ED396020F8dDB09A4b6F7E6040D4',

	// FEEDS (AggregatorV3Interface)
	ETH_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
	WBTC_USD: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',
	DAI_USD: '0x14866185B1962B63C3Ea9E03Bc1da838bab34C19',
	USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
	LINK_USD: '0xc59E3633BAAC79493d908e63626716e204A45EdF',
	WSTETH_USD: '0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E',
	PYUSD_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E'
}

const deploySwapPay: DeployFunction = async (
	hre: HardhatRuntimeEnvironment
) => {
	const { deployments, getNamedAccounts, network } = hre
	const { deploy, log } = deployments
	const { deployer } = await getNamedAccounts()

	const { address: daiAddress } = (await deployments.get('DAI')) as {
		address: Address
	}

	const { address: linkAddress } = (await deployments.get('LINK')) as {
		address: Address
	}

	const { address: usdcAddress } = (await deployments.get('USDC')) as {
		address: Address
	}

	const { address: wbtcAddress } = (await deployments.get('WBTC')) as {
		address: Address
	}

	const { address: wstethAddress } = (await deployments.get('WSTETH')) as {
		address: Address
	}

	const args = [
		addresses.DAI,
		addresses.LINK,
		addresses.USDC,
		addresses.WBTC,
		addresses.WSTETH,
		addresses.PYUSD,

		addresses.DAI_USD,
		addresses.ETH_USD,
		addresses.LINK_USD,
		addresses.USDC_USD,
		addresses.WBTC_USD,
		addresses.WSTETH_USD,
		addresses.PYUSD_USD,
		POOL_MANAGER_ADDRESS,
		POOL_TEST_SWAP_ADDRESS
	]

	log('----------------------------------------------------')
	log('Deploying SwapPay and waiting for confirmations...')

	const swapPay = await deploy('SwapPay', {
		from: deployer,
		args,
		log: true,
		waitConfirmations: networkConfig[network.name].blockConfirmations || 1
	})

	log(`✅ SwapPay deployed at ${swapPay.address}`)

	if (!developmentChains.includes(network.name)) {
		await verify(swapPay.address, args)
	}
}

export default deploySwapPay
deploySwapPay.tags = ['deploy', 'swapPay']

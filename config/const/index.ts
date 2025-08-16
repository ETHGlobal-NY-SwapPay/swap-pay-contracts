import { NetworkConfigInfo } from '@/models'

// Hardhat and Localhost are development chains
export const developmentChains = ['hardhat', 'localhost']

export const networkConfig: NetworkConfigInfo = {
	localhost: {},
	hardhat: {},
	ethereumSepolia: {
		blockConfirmations: 3
	}
}

import 'tsconfig-paths/register'
import 'dotenv/config'
import '@nomicfoundation/hardhat-toolbox-viem'
import '@nomicfoundation/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import 'hardhat-deploy'

import dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/config'
import { localhost, sepolia } from 'viem/chains'

import { ensureEnvVar } from './utils/ensure-env-var'

// Load environment variables
dotenv.config()

const {
	SCAN_API_KEY,
	ETHEREUM_SEPOLIA_RPC_HTTPS,
	DEPLOYER_WALLET_PRIVATE_KEY
} = process.env

// Ensure environment variables
const ethereumSepoliaUrl = ensureEnvVar(
	ETHEREUM_SEPOLIA_RPC_HTTPS,
	'ETHEREUM_SEPOLIA_RPC_HTTPS'
)

const apiKey = ensureEnvVar(SCAN_API_KEY, 'SCAN_API_KEY')

const deployerWalletPrivateKey = ensureEnvVar(
	DEPLOYER_WALLET_PRIVATE_KEY,
	'DEPLOYER_WALLET_PRIVATE_KEY'
)

// Set up accounts
const accounts: string[] = [deployerWalletPrivateKey]

// Set up Solidity compiler
const solcUserConfig = (version: string) => {
	return {
		version,
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	}
}

const config: HardhatUserConfig = {
	defaultNetwork: 'hardhat',
	networks: {
		hardhat: {
			allowUnlimitedContractSize: true,
			chainId: 1337
		},
		localhost: {
			url: 'http://127.0.0.1:8545',
			chainId: localhost.id
		},
		ethereumSepolia: {
			url: ethereumSepoliaUrl,
			accounts,
			chainId: sepolia.id
		}
	},

	namedAccounts: {
		deployer: {
			default: 0
		}
	},

	sourcify: {
		enabled: true
	},

	solidity: {
		compilers: [solcUserConfig('0.8.28')],
		overrides: {}
	},

	etherscan: {
		apiKey
	},

	typechain: {
		outDir: 'typechain-types',
		target: 'ethers-v6'
	},

	mocha: {
		timeout: 200000
	}
}

export default config

README.md
Markdown

# SwapPay: Atomic Multi-Token Payment Gateway Contracts

![ETHGlobal NY](https://img.shields.io/badge/ETHGlobal-NY_2025-blue.svg) ![Ledger Ready](https://img.shields.io/badge/Ledger-EIP--7730-brightgreen.svg) ![Hardhat](https://img.shields.io/badge/Hardhat-3.0-orange.svg) ![Viem](https://img.shields.io/badge/Viem-Ready-violet.svg)

### A Ledger Bounty Submission for ETHGlobal New York 2025

## Abstract

This repository contains the Solidity smart contracts for **SwapPay**, a decentralized payment gateway designed to facilitate the purchase of on-chain assets (specifically ERC-721 tokens) using a basket of disparate ERC-20 tokens within a single, atomic transaction. The core innovation is the integration with Ledger hardware wallets via the **EIP-7730 (Clear Signing)** standard, which provides users with transaction transparency and mitigates blind signing vulnerabilities.

> **Quick Links:**
> * [Live dApp Deployment](DEMO_URL)
> * [Video Walkthrough](VIDEO_URL)

---

## System Architecture

The system is architected around two primary on-chain components, orchestrated by a client-side dApp and leveraging Uniswap V3 for liquidity.

* **`SwapPay.sol` (Core Logic Contract):** This contract serves as the primary entry point for users. It orchestrates the entire swap-and-purchase process. It holds the logic for pulling pre-approved user funds, executing swaps against a designated Uniswap V3 pool, validating the resulting balance, and initiating the NFT transfer.
* **`SwapPayNFT.sol` (Asset Contract):** A standard OpenZeppelin ERC-721 contract representing the asset being sold. For operational security, ownership of the minted NFTs is transferred to the `SwapPay.sol` contract post-deployment, making it the sole entity capable of transferring the NFT upon successful payment.
* **Uniswap V3 Router:** The `SwapPay` contract interfaces with a specified Uniswap V3 router to execute token swaps, converting the user's input tokens into a single, predefined payment token (e.g., USDC).

The transactional flow is as follows:
`User -> dApp (Viem) -> SwapPay.sol -> Uniswap V3 Router -> SwapPayNFT.sol`

---

## Transactional Flow & Execution Path

The end-to-end process is designed to be atomic from the user's perspective, though it requires a one-time approval phase.

1.  **Approval Phase (User-side):** The user must first issue `approve()` transactions for each ERC-20 token they intend to use, granting spending permission to the `SwapPay.sol` contract address.

2.  **Execution Phase (User-side):** The user initiates the purchase by calling the `swapAndBuyNFT(address[] memory _inputTokens, uint256[] memory _inputAmounts, uint256 _tokenId)` function on the `SwapPay.sol` contract.

3.  **Clear Signing (Ledger Hardware):** The dApp passes the transaction payload along with the corresponding EIP-7730 JSON metadata to the Ledger device. The device firmware parses this metadata to render a human-readable summary of the function call and its parameters, ensuring the user is fully aware of the operation's scope before signing.

4.  **Contract Execution Path (On-chain):** Upon execution, the `swapAndBuyNFT` function performs the following steps atomically:
    a. Iteratively calls `transferFrom()` on each input token contract to pull funds from `msg.sender`.
    b. Iteratively calls `ISwapRouter.exactInputSingle()` on the Uniswap V3 Router, swapping each input token for the designated `paymentToken`.
    c. Aggregates the balance of `paymentToken` received.
    d. Validates the aggregated balance against the NFT's price with a `require()` statement.
    e. Calls `safeTransferFrom()` on the `SwapPayNFT` contract to transfer the asset to `msg.sender`.
    f. Refunds any surplus `paymentToken` from the swap back to the user.

---

## Local Development Environment

This project utilizes the Hardhat 3 Beta framework.

#### Prerequisites
* Node.js (v18 or higher)
* Git

#### 1. Clone & Install Dependencies
Clone the repository and install the required npm packages.
```bash
git clone [https://github.com/ETHGlobal-NY-SwapPay/swap-pay-contracts.git](https://github.com/ETHGlobal-NY-SwapPay/swap-pay-contracts.git)
cd swap-pay-contracts
npm install
2. Environment Configuration
Create a .env file from the provided example. This file is gitignored for security.

Bash

cp .env.example .env
Populate the .env file with your specific endpoints and private keys:

SEPOLIA_RPC_URL="<YOUR_ALCHEMY_OR_INFURA_RPC_URL>"
SEPOLIA_PRIVATE_KEY="<YOUR_0x_PREFIXED_PRIVATE_KEY>"
ETHERSCAN_API_KEY="<YOUR_ETHERSCAN_API_KEY>"
3. Compile Contracts
Compile the Solidity code and generate TypeChain artifacts.

Bash

npx hardhat compile
4. Execute Test Suite
The project includes both Solidity (Foundry-style) and TypeScript (node:test) tests.

Bash

# Run the complete test suite
npx hardhat test

# Run only TypeScript integration tests
npx hardhat test nodejs
Deployment to Sepolia
Deployment is managed via Hardhat Ignition for reliable, stateful deployments.

Verify Configuration: Ensure your .env is correctly configured and the deploying account is funded with Sepolia ETH.

Execute Ignition Module: Run the deployment script. The module path should correspond to your project's structure.

Bash

npx hardhat ignition deploy --network sepolia ignition/modules/SwapPay.ts
Upon successful execution, Ignition will log the deployed contract addresses to the console.

Project Structure
.
├── contracts/
│   ├── core/
│   │   ├── SwapPay.sol
│   │   └── SwapPayNFT.sol
│   └── interfaces/
├── ignition/
│   └── modules/
│       └── SwapPay.ts
├── test/
│   ├── SwapPay.test.ts
│   └── SwapPay.sol.test.ts
├── hardhat.config.ts
└── package.json

---

## **section 2: Technical Git Workflow Guide**

### Git Workflow & Commit Hygiene

This guide outlines the standard Git workflow for contributing to this repository. The objective is to maintain a clean, atomic, and well-documented commit history.

### The Staging-Commit-Push Cycle

The fundamental workflow involves moving changes from the working directory to the staging area (index), committing them to the local repository, and finally pushing them to the remote.

#### Step 1: Inspect the Working Directory (`git status`)
Before staging any changes, inspect the state of your working tree and staging area. This command is non-destructive and provides critical context.
```bash
git status
The output will list untracked files, modified files not yet staged, and changes that are staged for the next commit.

Step 2: Stage Changes (git add)
Move changes from the working directory to the staging area. Only staged changes will be included in the next commit.

To stage all modified and untracked files:

Bash

git add .
To stage a specific file:

Bash

git add contracts/core/SwapPay.sol
For interactive, patch-level staging (advanced):
This allows you to stage specific hunks of code within a file, which is useful for creating atomic commits.

Bash

git add -p
Step 3: Commit Staged Changes (git commit)
Record a snapshot of the staging area into your local repository history. Commits should be atomic, representing a single logical change.

Commit messages must adhere to the Conventional Commits specification.

Bash

git commit -m "feat: implement atomic swap logic in SwapPay contract"
Common Commit Types:

feat: A new feature.

fix: A bug fix.

docs: Documentation only changes.

style: Changes that do not affect the meaning of the code (white-space, formatting, etc).

refactor: A code change that neither fixes a bug nor adds a feature.

test: Adding missing tests or correcting existing tests.

chore: Changes to the build process or auxiliary tools.

Step 4: Push Commits to Remote (git push)
Synchronize your local repository's commit history with the remote repository on GitHub.

Bash

git push origin main
origin: The default alias for the remote repository URL.

main: The remote branch you are pushing to.

If you are pushing a new local branch for the first time, use the --set-upstream (or -u) flag: git push -u origin <your-feature-branch>.

Quick Reference (TL;DR)
Bash

# 1. Check state
git status

# 2. Stage all changes
git add .

# 3. Commit staged changes with a conventional message
git commit -m "refactor: optimize gas usage in swap function"

# 4. Push to the remote's main branch
git push origin main

# 4. Sube los cambios a GitHub
git push origin main
¡Y eso es todo! Repite este ciclo cada vez que completes una parte importante de tu trabajo. ¡Mucho éxito en el hackathon!
```

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFeeds {
	/// =========================
	/// ======== Structs ========
	/// =========================
	struct Balances {
		uint256 eth;
		uint256 wbtc;
		uint256 dai;
		uint256 usdc;
		uint256 link;
		uint256 wsteth;
		uint256 pyusd;
	}

	struct Prices {
		int256 ethUsd;
		int256 wbtcUsd;
		int256 daiUsd;
		int256 usdcUsd;
		int256 linkUsd;
		int256 wstethUsd;
		int256 pyusdUsd;
	}

	/// =========================
	/// ==== View Functions =====
	/// =========================
	function getBalances(
		address _account
	) external view returns (Balances memory balances);

	function getPrices() external view returns (Prices memory prices);

	/// @notice Convierte cantidad de token a USD (1e8) usando Chainlink
	function tokenToUsd(
		address token,
		uint256 amountToken
	) external view returns (uint256 usd1e8);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC20.sol';

import {IFeeds} from './core/interfaces/IFeeds.sol';
import {Native} from './core/libraries/Native.sol';

// Sepolia token addresses (referencia)
// wbtc = IERC20(0xDD2f20DB368a8Dba08718d8801f08B3E38FEcd08);
// dai  = IERC20(0xA1dA2d6b69dA9a3cBB20afbe302d74eD46a55500);
// usdc = IERC20(0x0045912A7Cf4ccEd07cB0197B1eB05eb5330cE04);
// link = IERC20(0x12D50F27df72c759B950a125FdeACe37e3ef21d1);
// wsteth = IERC20(0x3d2fBc87d4Bb4c0364a727bbFD3B97420B5BbDeB);
// pyusd = IERC20(0xE448eAbd8420ED396020F8dDB09A4b6F7E6040D4);

// Sepolia price feed addresses (Chainlink) (referencia)
// ethUsdFeed   = 0x694AA1769357215DE4FAC081bf1f309aDC325306
// wbtcUsdFeed  = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43
// daiUsdFeed   = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19
// usdcUsdFeed  = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E
// linkUsdFeed  = 0xc59E3633BAAC79493d908e63626716e204A45EdF
// wstethUsdFeed= 0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E
// pyusdUsdFeed = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E

contract Feeds is IFeeds, Native {
	/// =========================
	/// === Storage Variables ===
	/// =========================
	address internal immutable eth; // NATIVE
	IERC20 internal immutable wbtc;
	IERC20 internal immutable dai;
	IERC20 internal immutable usdc;
	IERC20 internal immutable link;
	IERC20 internal immutable wsteth;
	IERC20 internal immutable pyusd;

	AggregatorV3Interface internal immutable ethUsdFeed;
	AggregatorV3Interface internal immutable wbtcUsdFeed;
	AggregatorV3Interface internal immutable daiUsdFeed;
	AggregatorV3Interface internal immutable usdcUsdFeed;
	AggregatorV3Interface internal immutable linkUsdFeed;
	AggregatorV3Interface internal immutable wstethUsdFeed;
	AggregatorV3Interface internal immutable pyusdUsdFeed;

	/// =========================
	/// ====== Constructor ======
	/// =========================
	constructor(
		IERC20 _dai,
		IERC20 _link,
		IERC20 _usdc,
		IERC20 _wbtc,
		IERC20 _wsteth,
		IERC20 _pyusd,
		AggregatorV3Interface _daiUsdFeed,
		AggregatorV3Interface _ethUsdFeed,
		AggregatorV3Interface _linkUsdFeed,
		AggregatorV3Interface _usdcUsdFeed,
		AggregatorV3Interface _wbtcUsdFeed,
		AggregatorV3Interface _wstethUsdFeed,
		AggregatorV3Interface _pyusdUsdFeed
	) {
		eth = NATIVE;
		wbtc = _wbtc;
		dai = _dai;
		usdc = _usdc;
		link = _link;
		wsteth = _wsteth;
		pyusd = _pyusd;

		ethUsdFeed = _ethUsdFeed;
		wbtcUsdFeed = _wbtcUsdFeed;
		daiUsdFeed = _daiUsdFeed;
		usdcUsdFeed = _usdcUsdFeed;
		linkUsdFeed = _linkUsdFeed;
		wstethUsdFeed = _wstethUsdFeed;
		pyusdUsdFeed = _pyusdUsdFeed;
	}

	/// =========================
	/// ==== View Functions =====
	/// =========================
	function getBalances(
		address _account
	) external view returns (Balances memory balances) {
		balances = Balances({
			eth: _account.balance,
			wbtc: wbtc.balanceOf(_account),
			dai: dai.balanceOf(_account),
			usdc: usdc.balanceOf(_account),
			link: link.balanceOf(_account),
			wsteth: wsteth.balanceOf(_account),
			pyusd: pyusd.balanceOf(_account)
		});
	}

	function getPrices() external view returns (Prices memory prices) {
		prices = Prices({
			ethUsd: _getLatestPrice(ethUsdFeed),
			wbtcUsd: _getLatestPrice(wbtcUsdFeed),
			daiUsd: _getLatestPrice(daiUsdFeed),
			usdcUsd: _getLatestPrice(usdcUsdFeed),
			linkUsd: _getLatestPrice(linkUsdFeed),
			wstethUsd: _getLatestPrice(wstethUsdFeed),
			pyusdUsd: _getLatestPrice(pyusdUsdFeed)
		});
	}

	/// =========================
	/// === Public Helpers  =====
	/// =========================

	/// @notice Convierte cantidad de token a USD (1e8) usando Chainlink
	function tokenToUsd(
		address token,
		uint256 amountToken
	) public view returns (uint256 usd1e8) {
		AggregatorV3Interface feed = _getFeedFor(token);
		int256 px = _getLatestPrice(feed); // 1e8
		require(px > 0, 'bad price');
		uint8 decs = _tokenDecimals(token);
		// usd = amount * price / 10^tokenDecimals
		usd1e8 = (amountToken * uint256(px)) / (10 ** decs);
	}

	/// @notice Verifica si el token es uno de los soportados por este contrato/feeds
	function _isSupportedToken(address token) internal view returns (bool) {
		return (token == eth ||
			token == address(wbtc) ||
			token == address(dai) ||
			token == address(usdc) ||
			token == address(link) ||
			token == address(wsteth));
	}

	/// =========================
	/// === Internal Helpers ====
	/// =========================

	function _getLatestPrice(
		AggregatorV3Interface feed
	) private view returns (int256) {
		(, int256 price, , , ) = feed.latestRoundData();
		return price; // típicamente 1e8
	}

	function _getFeedFor(
		address token
	) internal view returns (AggregatorV3Interface feed) {
		if (token == eth) return ethUsdFeed;
		if (token == address(wbtc)) return wbtcUsdFeed;
		if (token == address(dai)) return daiUsdFeed;
		if (token == address(usdc)) return usdcUsdFeed;
		if (token == address(link)) return linkUsdFeed;
		if (token == address(wsteth)) return wstethUsdFeed;
		if (token == address(pyusd)) return pyusdUsdFeed;
		revert('feed not found');
	}

	/// @dev Decimales esperados por token (ajusta si tu despliegue difiere)
	function _tokenDecimals(address token) internal view returns (uint8) {
		if (token == eth) return 18; // ETH nativo
		if (token == address(wbtc)) return 8; // WBTC estándar
		if (token == address(usdc)) return 6; // USDC
		if (token == address(dai)) return 18;
		if (token == address(link)) return 18;
		if (token == address(wsteth)) return 18;
		if (token == address(pyusd)) return 6; // PYUSD
		revert('decimals unknown');
	}

	function _tokenToUsd(
		address token,
		uint256 amount
	) internal view virtual returns (uint256) {
		// usa tus feeds: 1e8
		// (ya lo tienes implementado en Feeds/FeedsRegistry)
		return tokenToUsd(token, amount);
	}
}

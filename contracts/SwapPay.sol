// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// chainlink
import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
// openzeppelin
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC20.sol';
// solady
import {ERC20} from 'solady/src/tokens/ERC20.sol';

import {Transfer} from './core/libraries/Transfer.sol';
import {Feeds} from './Feeds.sol';

/// @title SwapPay (Treasury-backed, PYUSD-only payout)
/// @notice Recibe canastas de tokens, valora con Chainlink y paga en PYUSD desde la tesorería.
///         El contrato retiene los tokens recibidos (no hace swaps externos).
contract SwapPay is Feeds, Transfer {
	/// ======================
	/// ======= Errors =======
	/// ======================
	error EMPTY_ARRAY();
	error INSUFFICIENT_ALLOWANCE();
	error INSUFFICIENT_BALANCE();
	error INSUFFICIENT_USD_VALUE();
	error INSUFFICIENT_TREASURY();
	error INVALID_VALUE();
	error INVALID_CALL_FUNCTION_DATA();
	error MISMATCH();
	error PAYMENT_NOT_PYUSD();
	error TOKEN_ALREADY_EXISTS();
	error TOKEN_NOT_FOUND();
	error TOKEN_NOT_SUPPORTED();
	error ZERO_ADDRESS();

	/// =========================
	/// ======== Events =========
	/// =========================
	event TokenAdded(address indexed token);
	event TokenRemoved(address indexed token);
	event TreasuryFunded(address indexed from, uint256 amount);
	event TreasuryWithdrawn(
		address indexed to,
		address indexed token,
		uint256 amount
	);
	event PaymentExecuted(
		address indexed payer,
		uint256 usdSpent1e8,
		uint256 pyusdPaid,
		address indexed target,
		bytes callFunctionData
	);

	/// =========================
	/// === Storage Variables ===
	/// =========================
	mapping(address => bool) private tokens;

	receive() external payable {}

	/// =========================
	/// ====== Constructor ======
	/// =========================
	constructor(
		address _dai,
		address _link,
		address _usdc,
		address _wbtc,
		address _wsteth,
		address _pyusd,
		AggregatorV3Interface _daiUsdFeed,
		AggregatorV3Interface _ethUsdFeed,
		AggregatorV3Interface _linkUsdFeed,
		AggregatorV3Interface _usdcUsdFeed,
		AggregatorV3Interface _wbtcUsdFeed,
		AggregatorV3Interface _wstethUsdFeed,
		AggregatorV3Interface _pyusdUsdFeed
	)
		Feeds(
			IERC20(_dai),
			IERC20(_link),
			IERC20(_usdc),
			IERC20(_wbtc),
			IERC20(_wsteth),
			IERC20(_pyusd),
			_daiUsdFeed,
			_ethUsdFeed,
			_linkUsdFeed,
			_usdcUsdFeed,
			_wbtcUsdFeed,
			_wstethUsdFeed,
			_pyusdUsdFeed
		)
	{
		tokens[_dai] = true;
		tokens[_link] = true;
		tokens[_usdc] = true;
		tokens[_wbtc] = true;
		tokens[_wsteth] = true;
		tokens[_pyusd] = true;
	}

	/// =========================
	/// ======= Getters =========
	/// =========================

	function isTokenSupported(address _token) external view returns (bool) {
		return tokens[_token];
	}

	/// =========================
	/// ======= Setters =========
	/// =========================

	function addToToken(address _token) external {
		if (tokens[_token]) revert TOKEN_ALREADY_EXISTS();
		tokens[_token] = true;
		emit TokenAdded(_token);
	}

	function removeFromTokens(address _token) external {
		if (!tokens[_token]) revert TOKEN_NOT_FOUND();
		tokens[_token] = false;
		emit TokenRemoved(_token);
	}

	/// ===============================
	/// = External / Public Functions =
	/// ===============================

	function execute(
		address[] calldata _tokens,
		uint256[] calldata _amounts,
		address _target,
		bytes calldata _callFunctionData,
		uint256 _amount,
		uint256 /* _minOutPaymentToken, ignorado */
	) external {
		if (_tokens.length != _amounts.length) revert MISMATCH();
		if (_tokens.length == 0) revert EMPTY_ARRAY();
		if (_target == address(0)) revert ZERO_ADDRESS();
		if (_amount == 0) revert INVALID_VALUE();

		uint256 basketUsd = 0;
		for (uint256 i; i < _tokens.length; ) {
			address token = _tokens[i];
			uint256 amount = _amounts[i];

			if (!tokens[token]) revert TOKEN_NOT_SUPPORTED();

			if (token == address(pyusd)) revert PAYMENT_NOT_PYUSD();

			if (amount == 0) revert INVALID_VALUE();

			if (ERC20(token).balanceOf(msg.sender) < amount)
				revert INSUFFICIENT_BALANCE();

			if (ERC20(token).allowance(msg.sender, address(this)) < amount)
				revert INSUFFICIENT_ALLOWANCE();

			ERC20(token).transferFrom(msg.sender, address(this), amount);

			basketUsd += _tokenToUsd(_tokens[i], _amounts[i]); // 1e8

			unchecked {
				++i;
			}
		}

		uint256 targetUsd = _tokenToUsd(address(pyusd), _amount); // 1e8

		if (basketUsd < targetUsd) revert INSUFFICIENT_USD_VALUE();

		if (ERC20(address(pyusd)).balanceOf(address(this)) < _amount)
			revert INSUFFICIENT_TREASURY();

		if (_callFunctionData.length == 0) {
			ERC20(address(pyusd)).transfer(_target, _amount);
		} else {
			ERC20(address(pyusd)).approve(_target, 0);
			ERC20(address(pyusd)).approve(_target, _amount);
			(bool ok, ) = _target.call(_callFunctionData);
			if (!ok) revert INVALID_CALL_FUNCTION_DATA();
		}

		emit PaymentExecuted(
			msg.sender,
			targetUsd,
			_amount,
			_target,
			_callFunctionData
		);
	}

	/// =========================
	/// === Private Functions ===
	/// =========================
	function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
		return a == 0 ? 0 : 1 + ((a - 1) / b);
	}

	function _tokenToUsd(
		address token,
		uint256 amountToken
	) internal view override returns (uint256 usd1e8) {
		return Feeds._tokenToUsd(token, amountToken);
	}
}

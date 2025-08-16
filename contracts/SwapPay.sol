// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// chainlink
import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
// openzeppelin
import {IERC20} from '@openzeppelin/contracts/interfaces/IERC20.sol';
// solady
import {ERC20} from 'solady/src/tokens/ERC20.sol';
// uniswap
import {BaseHook} from '@uniswap/v4-periphery/src/utils/BaseHook.sol';
import {Hooks} from '@uniswap/v4-core/src/libraries/Hooks.sol';
import {IPoolManager} from '@uniswap/v4-core/src/interfaces/IPoolManager.sol';
import {IHooks} from '@uniswap/v4-core/src/interfaces/IHooks.sol';
import {PoolKey} from '@uniswap/v4-core/src/types/PoolKey.sol';
import {PoolId, PoolIdLibrary} from '@uniswap/v4-core/src/types/PoolId.sol';
import {BalanceDelta} from '@uniswap/v4-core/src/types/BalanceDelta.sol';
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from '@uniswap/v4-core/src/types/BeforeSwapDelta.sol';
import {Currency} from '@uniswap/v4-core/src/types/Currency.sol';
import {TickMath} from '@uniswap/v4-core/src/libraries/TickMath.sol';

import {Transfer} from './core/libraries/Transfer.sol';

import {Feeds} from './Feeds.sol';

interface IPoolSwapTest {
	struct SwapParams {
		/// Whether to swap token0 for token1 or vice versa
		bool zeroForOne;
		/// The desired input amount if negative (exactIn), or the desired output amount if positive (exactOut)
		int256 amountSpecified;
		/// The sqrt price at which, if reached, the swap will stop executing
		uint160 sqrtPriceLimitX96;
	}

	function swap(
		address poolManager,
		PoolKey calldata key,
		SwapParams calldata params,
		bytes calldata hookData
	) external;
}

contract SwapPay is Feeds, Transfer {
	using PoolIdLibrary for PoolKey;

	/// ======================
	/// ======= Errors =======
	/// ======================

	error EMPTY_ARRAY();
	error INSUFFICIENT_ALLOWANCE();
	error INSUFFICIENT_BALANCE();
	error INSUFFICIENT_USD_VALUE();
	error INVALID_VALUE();
	error INVALID_CALL_FUNCTION_DATA();
	error MISMATCH();
	error TOKEN_ALREADY_EXISTS();
	error TOKEN_NOT_FOUND();
	error TOKEN_NOT_SUPPORTED();
	error ZERO_ADDRESS();

	/// =========================
	/// ======== Events =========
	/// =========================

	event TokenAdded(address indexed token);
	event TokenRemoved(address indexed token);
	event SwapExecuted(
		address indexed sender,
		uint256 finalBalance,
		uint256 finalBalanceUsd,
		address indexed paymentToken,
		address indexed target,
		bytes callFunctionData
	);

	/// =========================
	/// === Storage Variables ===
	/// =========================

	address public immutable POOL_MANAGER;
	address public immutable POOL_SWAP_TEST;

	uint16 constant SWAP_FEE_BPS = 3; // 3 bps = 0.03%
	uint16 constant HOOK_FEE_BPS = 1; // 1 bps = 0.01%
	uint16 constant BPS_DENOM = 10000; // 10000 bps = 100%

	mapping(address => bool) private tokens;
	mapping(PoolId => uint256) public afterSwapCount;

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
		AggregatorV3Interface _pyusdUsdFeed,
		address _poolManager,
		address _poolSwapTest
	)
		// BaseHook(IPoolManager(_poolManager))
		Feeds(
			IERC20(_wbtc),
			IERC20(_dai),
			IERC20(_usdc),
			IERC20(_link),
			IERC20(_wsteth),
			IERC20(_pyusd),
			_ethUsdFeed,
			_wbtcUsdFeed,
			_daiUsdFeed,
			_usdcUsdFeed,
			_linkUsdFeed,
			_wstethUsdFeed,
			_pyusdUsdFeed
		)
	{
		if (_poolManager == address(0) || _poolSwapTest == address(0))
			revert ZERO_ADDRESS();

		// ✅ CORRECTO
		POOL_MANAGER = _poolManager;
		POOL_SWAP_TEST = _poolSwapTest;
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

	/// =================================
	/// == External / Public Functions ==
	/// =================================

	// ADD OWNABLE, NOREENTRANCY, What do with the fee?

	function execute(
		address[] calldata _tokens,
		uint256[] calldata _amounts,
		address _target,
		bytes calldata _callFunctionData,
		uint256 _amount,
		address _paymentToken,
		uint256 minOutPaymentToken
	) external payable {
		if (_tokens.length != _amounts.length) revert MISMATCH();
		if (_tokens.length == 0) revert EMPTY_ARRAY();
		if (_isZeroAddress(_target)) revert ZERO_ADDRESS();
		if (_callFunctionData.length == 0) revert INVALID_CALL_FUNCTION_DATA();
		if (!_isTokenSupported(_paymentToken)) revert TOKEN_NOT_SUPPORTED();

		// pull tokens
		for (uint256 i; i < _tokens.length; ) {
			if (!_isTokenSupported(_tokens[i])) revert TOKEN_NOT_SUPPORTED();

			if (_amounts[i] == 0) revert INVALID_VALUE();

			if (ERC20(_tokens[i]).balanceOf(msg.sender) < _amounts[i])
				revert INSUFFICIENT_BALANCE();

			if (ERC20(_tokens[i]).allowance(msg.sender, address(this)) < _amounts[i])
				revert INSUFFICIENT_ALLOWANCE();

			ERC20(_tokens[i]).transferFrom(msg.sender, address(this), _amounts[i]);

			unchecked {
				i++;
			}
		}

		// calculate target in USD
		uint256 targetUsd = _tokenToUsd(_paymentToken, _amount);

		uint16 totalFeeBps = SWAP_FEE_BPS + HOOK_FEE_BPS;

		uint256 grossUsdNeeded = _ceilDiv(
			targetUsd * BPS_DENOM,
			(BPS_DENOM - totalFeeBps)
		);

		uint256 basketUsd = 0;
		for (uint256 i; i < _tokens.length; ) {
			basketUsd += tokenToUsd(_tokens[i], _amounts[i]);

			unchecked {
				i++;
			}
		}

		if (basketUsd < grossUsdNeeded) revert INSUFFICIENT_USD_VALUE();

		// validate that paymentToken is in the basket
		uint256 paymentFromBasket;
		for (uint256 i; i < _tokens.length; ) {
			if (_tokens[i] == _paymentToken) {
				paymentFromBasket += _amounts[i];
			}

			unchecked {
				i++;
			}
		}

		bool paymentTokenPresent = (paymentFromBasket > 0);
		uint256 count;
		for (uint256 i; i < _tokens.length; ) {
			if (!paymentTokenPresent || _tokens[i] != _paymentToken) {
				++count;
			}

			unchecked {
				i++;
			}
		}

		// swap tokens
		bytes memory hookData = abi.encode(uint16(1), address(this), msg.sender);
		_swapAllToToken(_tokens, _amounts, _paymentToken, hookData);

		// validate final balance
		uint256 finalBalance = ERC20(_paymentToken).balanceOf(address(this));
		if (finalBalance < minOutPaymentToken) revert INVALID_VALUE();

		uint256 finalBalanceUsd = _tokenToUsd(_paymentToken, finalBalance);
		if (finalBalanceUsd < targetUsd) revert INSUFFICIENT_USD_VALUE();

		// call target contract
		ERC20(_paymentToken).approve(_target, 0);
		ERC20(_paymentToken).approve(_target, finalBalance);

		(bool ok, ) = _target.call(_callFunctionData);

		if (!ok) revert INVALID_CALL_FUNCTION_DATA();

		emit SwapExecuted(
			msg.sender,
			finalBalance,
			finalBalanceUsd,
			_paymentToken,
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

	function _isTokenSupported(address _token) private view returns (bool) {
		return tokens[_token];
	}

	function _isZeroAddress(address _address) private pure returns (bool) {
		return _address == address(0);
	}

	function _tokenToUsd(
		address token,
		uint256 amountToken
	) internal view override returns (uint256 usd1e8) {
		return Feeds._tokenToUsd(token, amountToken);
	}

	function _swapAllToToken(
		address[] memory inTokens,
		uint256[] memory inAmounts,
		address paymentToken,
		bytes memory hookData
	) internal {
		for (uint256 i; i < inTokens.length; ) {
			address tokenIn = inTokens[i];
			uint256 amtIn = inAmounts[i];

			if (amtIn == 0 || tokenIn == paymentToken) {
				unchecked {
					i++;
				}

				continue;
			}

			// approve tokens
			ERC20(tokenIn).approve(POOL_SWAP_TEST, 0);
			ERC20(tokenIn).approve(POOL_SWAP_TEST, amtIn);

			ERC20(tokenIn).transfer(POOL_SWAP_TEST, amtIn);

			// get pool key
			(address c0, address c1) = tokenIn < paymentToken
				? (tokenIn, paymentToken)
				: (paymentToken, tokenIn);

			PoolKey memory key = PoolKey({
				currency0: Currency.wrap(c0),
				currency1: Currency.wrap(c1),
				fee: 3000,
				tickSpacing: 60,
				hooks: IHooks(address(0))
			});

			// set up the swap parameters
			bool zeroForOne = (tokenIn == Currency.unwrap(key.currency0));
			// These values are standard for Uniswap V3/V4 TickMath
			uint160 MIN_SQRT_RATIO = 4295128739 + 1;
			uint160 MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342 -
					1;
			uint160 limit = zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO;

			IPoolSwapTest.SwapParams memory params = IPoolSwapTest.SwapParams({
				zeroForOne: zeroForOne,
				amountSpecified: -int256(amtIn),
				sqrtPriceLimitX96: limit
			});

			// call the swap function
			IPoolSwapTest.SwapParams memory ipoolParams = IPoolSwapTest.SwapParams({
				zeroForOne: params.zeroForOne,
				amountSpecified: params.amountSpecified,
				sqrtPriceLimitX96: params.sqrtPriceLimitX96
			});

			IPoolSwapTest(POOL_SWAP_TEST).swap(
				POOL_MANAGER,
				key,
				ipoolParams,
				hookData
			);

			unchecked {
				i++;
			}
		}
	}

	/// ==========================
	/// ======== Overrides =======
	/// ==========================

	// function getHookPermissions()
	// 	public
	// 	pure
	// 	override
	// 	returns (Hooks.Permissions memory)
	// {
	// 	return
	// 		Hooks.Permissions({
	// 			beforeInitialize: false,
	// 			afterInitialize: false,
	// 			beforeAddLiquidity: false,
	// 			afterAddLiquidity: false,
	// 			beforeRemoveLiquidity: false,
	// 			afterRemoveLiquidity: false,
	// 			beforeSwap: false,
	// 			afterSwap: false,
	// 			beforeDonate: false,
	// 			afterDonate: false,
	// 			beforeSwapReturnDelta: false,
	// 			afterSwapReturnDelta: false,
	// 			afterAddLiquidityReturnDelta: false,
	// 			afterRemoveLiquidityReturnDelta: false
	// 		});
	// }

	// function afterSwap(
	// 	address,
	// 	PoolKey calldata key,
	// 	IPoolSwapTest.SwapParams calldata,
	// 	BalanceDelta,
	// 	bytes calldata
	// ) external returns (bytes4, int128) {
	// 	return (BaseHook.afterSwap.selector, 0);
	// }
}

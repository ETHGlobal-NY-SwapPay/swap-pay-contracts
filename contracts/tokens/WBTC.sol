// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract WBTC is ERC20 {
	constructor() ERC20('Wrapped Bitcoin', 'WBTC') {}

	function mint(address to, uint256 amount) public {
		_mint(to, amount);
	}

	function decimals() public pure override returns (uint8) {
		return 8; // WBTC has 8 decimals
	}
}

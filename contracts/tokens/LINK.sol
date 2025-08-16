// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract LINK is ERC20 {
	constructor() ERC20('ChainLink Token', 'LINK') {}

	function mint(address to, uint256 amount) public {
		_mint(to, amount);
	}
}

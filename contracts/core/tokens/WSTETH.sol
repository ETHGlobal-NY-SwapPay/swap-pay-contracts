// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract WSTETH is ERC20 {
	constructor() ERC20('Wrapped Staked Ether', 'WSTETH') {}

	function mint(address to, uint256 amount) public {
		_mint(to, amount);
	}
}

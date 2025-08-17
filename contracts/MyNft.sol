// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from 'solady/src/tokens/ERC20.sol';
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import {ERC721URIStorage} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {Base64} from '@openzeppelin/contracts/utils/Base64.sol';

import {Transfer} from './core/libraries/Transfer.sol';

contract MyNft is
	ERC721,
	ERC721Enumerable,
	ERC721URIStorage,
	Ownable,
	Transfer
{
	using Strings for uint256;

	/// =========================
	/// ========= Errors ========
	/// =========================
	error INSUFFICIENT_ALLOWANCE();
	error INSUFFICIENT_FUNDS();
	error SAME_PRICE();
	error TOKEN_SUPPORTED();
	error TOKEN_NOT_SUPPORTED();

	/// =========================
	/// ========= Events ========
	/// =========================
	event PriceSeted(uint256 indexed _price);
	event TokenAdded(address indexed _token);
	event TokenRemoved(address indexed _token);
	event NftPurchased(address indexed _to, uint256 indexed _id);

	/// =========================
	/// === Storage Variables ===
	/// =========================
	uint256 private counterId;
	uint256 private price;
	mapping(address => bool) private tokens;

	/// =========================
	/// ====== Constructor ======
	/// =========================
	constructor(
		uint256 _price,
		address _pyusd
	) ERC721('MyNft', 'MNFT') Ownable(msg.sender) {
		price = _price;
		tokens[_pyusd] = true;
		_safeMint(msg.sender);
	}

	/// =========================
	/// ======= Getters =========
	/// =========================
	function getCounterId() external view returns (uint256) {
		return counterId;
	}

	function getPrice() external view returns (uint256) {
		return price;
	}

	function isTokenSupported(address _token) external view returns (bool) {
		return tokens[_token];
	}

	/// =========================
	/// ======= Setters =========
	/// =========================
	function setPrice(uint256 _price) external onlyOwner {
		if (price == _price) revert SAME_PRICE();
		price = _price;
		emit PriceSeted(_price);
	}

	function addToToken(address _token) external onlyOwner {
		if (tokens[_token]) revert TOKEN_SUPPORTED();
		tokens[_token] = true;
		emit TokenAdded(_token);
	}

	function removeFromTokens(address _token) external onlyOwner {
		if (!tokens[_token]) revert TOKEN_NOT_SUPPORTED();
		tokens[_token] = false;
		emit TokenRemoved(_token);
	}

	/// =========================
	/// ==== View Functions =====
	/// =========================
	function getLastUri() external view returns (string memory) {
		return super.tokenURI(counterId - 1);
	}

	/// =================================
	/// == External / Public Functions ==
	/// =================================

	function buyNFT(address _to, address _token) external {
		if (!_isTokenSupported(_token)) revert TOKEN_NOT_SUPPORTED();
		if (ERC20(_token).balanceOf(msg.sender) < price)
			revert INSUFFICIENT_FUNDS();
		if (ERC20(_token).allowance(msg.sender, address(this)) < price)
			revert INSUFFICIENT_ALLOWANCE();

		_transferAmountFrom(
			_token,
			TransferData({from: msg.sender, to: address(this), amount: price})
		);

		uint256 id = _safeMint(_to);

		emit NftPurchased(_to, id);
	}

	/// =========================
	/// === Private Functions ===
	/// =========================

	function _safeMint(address _to) private returns (uint256) {
		uint256 id = counterId;
		counterId++;

		// Metadata fija
		string memory _name = string.concat(
			'Bored Ape Yacht Club #7706',
			id.toString()
		);
		string
			memory _desc = 'The Bored Ape Yacht Club is a collection of 10,000 unique Bored Ape NFTs- unique digital collectibles living on the Ethereum blockchain. Your Bored Ape doubles as your Yacht Club membership card, and grants access to members-only benefits, the first of which is access to THE BATHROOM, a collaborative graffiti board. Future areas and perks can be unlocked by the community through roadmap activation. Visit www.BoredApeYachtClub.com for more details';
		string
			memory imageCid = 'bafkreifjmyp4djivo26yshgsx7abcrjezr75mry43ocr6zyed43ft2zl6i';
		string memory imageField = string.concat('ipfs://', imageCid);

		// JSON plano
		string memory json = string(
			abi.encodePacked(
				'{"name":"',
				_name,
				'","description":"',
				_desc,
				'","image":"',
				imageField,
				'"}'
			)
		);

		// data:application/json;base64,<...>
		string memory uri = string(
			abi.encodePacked(
				'data:application/json;base64,',
				Base64.encode(bytes(json))
			)
		);

		// ¡OJO! Llamamos al _safeMint de ERC721, no a nosotros mismos.
		super._safeMint(_to, id);
		_setTokenURI(id, uri);

		return id;
	}

	function _isTokenSupported(address _token) private view returns (bool) {
		return tokens[_token];
	}

	// The following functions are overrides required by Solidity.

	function tokenURI(
		uint256 tokenId
	) public view override(ERC721, ERC721URIStorage) returns (string memory) {
		return super.tokenURI(tokenId);
	}

	function _update(
		address to,
		uint256 tokenId,
		address auth
	) internal override(ERC721, ERC721Enumerable) returns (address) {
		return super._update(to, tokenId, auth);
	}

	function _increaseBalance(
		address account,
		uint128 value
	) internal override(ERC721, ERC721Enumerable) {
		super._increaseBalance(account, value);
	}

	function supportsInterface(
		bytes4 interfaceId
	)
		public
		view
		override(ERC721, ERC721Enumerable, ERC721URIStorage)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from 'solady/src/tokens/ERC20.sol';
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import {ERC721URIStorage} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {Base64} from '@openzeppelin/contracts/utils/Base64.sol';

import {Transfer} from '../libraries/Transfer.sol';

interface ISWapPay {
	function execute(
		address[] calldata _tokens,
		uint256[] calldata _amounts,
		address _target,
		bytes calldata _callFunctionData
	) external payable returns (bool);
}

contract PixelCounterNFT is
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
		uint256 _price
	) ERC721('Pixel Counter NFT', 'PCNFT') Ownable(msg.sender) {
		price = _price;
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
		price = price;

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
	/// ======== Helpers ========
	/// =========================

	function generateSVG(
		string memory number
	) internal pure returns (string memory) {
		uint8 digitWidth = 5;
		uint8 digitHeight = 7;
		uint8 pixelSize = 20;
		uint spacing = 10;
		uint svgWidth = bytes(number).length * (digitWidth * pixelSize + spacing);
		uint svgHeight = digitHeight * pixelSize;

		string memory svg = string(
			abi.encodePacked(
				'<svg xmlns="http://www.w3.org/2000/svg" width="',
				svgWidth.toString(),
				'" height="',
				svgHeight.toString(),
				'" style="background:#213147">'
			)
		);

		for (uint i = 0; i < bytes(number).length; i++) {
			uint8 digit = uint8(bytes(number)[i]) - 48;
			svg = string(
				abi.encodePacked(
					svg,
					renderDigit(
						digit,
						i * (digitWidth * pixelSize + spacing),
						0,
						pixelSize
					)
				)
			);
		}

		return string(abi.encodePacked(svg, '</svg>'));
	}

	function renderDigit(
		uint8 digit,
		uint xOffset,
		uint yOffset,
		uint pixelSize
	) internal pure returns (string memory) {
		bytes memory svgPart;
		uint8[35] memory bitmap = digitBitmaps(digit);

		for (uint i = 0; i < 35; i++) {
			if (bitmap[i] == 1) {
				uint x = (i % 5) * pixelSize + xOffset;
				uint y = (i / 5) * pixelSize + yOffset;

				svgPart = abi.encodePacked(
					svgPart,
					'<rect x="',
					x.toString(),
					'" y="',
					y.toString(),
					'" width="',
					pixelSize.toString(),
					'" height="',
					pixelSize.toString(),
					'" fill="white"/>'
				);
			}
		}

		return string(svgPart);
	}

	function digitBitmaps(uint8 digit) internal pure returns (uint8[35] memory) {
		if (digit == 0)
			return [
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				1,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 1)
			return [
				0,
				0,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				1,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 2)
			return [
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 3)
			return [
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 4)
			return [
				1,
				0,
				0,
				1,
				0,
				1,
				0,
				0,
				1,
				0,
				1,
				0,
				0,
				1,
				0,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0
			];
		if (digit == 5)
			return [
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 6)
			return [
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 7)
			return [
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0
			];
		if (digit == 8)
			return [
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		if (digit == 9)
			return [
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				1,
				1,
				1,
				1,
				1
			];
		revert('Invalid digit');
	}

	/// =========================
	/// === Private Functions ===
	/// =========================

	function _safeMint(address _to) private returns (uint256) {
		uint256 id = counterId;
		counterId++;

		string memory number = id.toString();
		string memory svg = generateSVG(number);

		string memory json = Base64.encode(
			bytes(
				string(
					abi.encodePacked(
						'{"name":"Pixel Counter NFT #',
						number,
						'", "description":"ETHGlobal NY 2025: Pixel Counter NFT", "image":"data:image/svg+xml;base64,',
						Base64.encode(bytes(svg)),
						'"}'
					)
				)
			)
		);

		string memory uri = string(
			abi.encodePacked('data:application/json;base64,', json)
		);

		_safeMint(_to, id);
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

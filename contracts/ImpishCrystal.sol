// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract IImpishSpiral is IERC721 {

}

abstract contract ISpiralStaking {
  struct TokenIdInfo {
      uint256 ownedTokensIndex;
      address owner;
  }
  mapping(uint256 => TokenIdInfo) public stakedTokenOwners;
}

contract ImpishCrystal is ERC721, ERC721Enumerable, ERC721Burnable, Ownable, ReentrancyGuard {
    // Next TokenID
    uint32 public _tokenIdCounter;

    // Base URI
    string private _baseTokenURI;

    // Entropy
    bytes32 public entropy;

    // Contract addresses
    address public spirals;
    address public spiralStaking;

    // Struct that has info about a Crystal
    struct CrystalInfo {
      uint8 length;
      uint8 generation;
      uint8 sym;
      uint32 seed;
    }
    // Crystal TokeID => CrystalInfo
    mapping(uint256 => CrystalInfo) public crystals;

    // SpiralTokenID -> bitMap of generations, indicating of token was
    struct MintedSpiralInfo {
      bool minted;
      uint32 tokenId;
    }
    // SpiralTokenID => gen number => MintedSpiralInfo
    mapping(uint256 => mapping(uint256 => MintedSpiralInfo)) public mintedSpirals;

    constructor(address _spirals, address _spiralStaking) ERC721("ImpishCrystal", "Crystal") {
      // Set BaseURI
      _baseTokenURI = "https://impishdao.com/crystalapi/crystal/metadata/";

      // Contract addresses
      spirals = _spirals;
      spiralStaking = _spiralStaking;

      // Mint 100 at startup for marketing and giveaways
      for (uint8 i = 0; i < 100; i++) {
        _mintCrystal(6);  // Initial tokens are 6th gen
      }
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Increment the entropy
    function nextEntropy() internal {
      entropy = keccak256(abi.encode(
            block.timestamp,
            blockhash(block.number),
            msg.sender,
            entropy));
    }

    function _mintCrystal(uint8 gen) internal {      
      uint32 tokenId = _tokenIdCounter;
      _tokenIdCounter += 1;

      nextEntropy();

      uint32 seed = uint32(uint256(entropy) & 0xFFFFFF);
      uint8 sym = uint8(uint256(entropy >> 32) & 0xFF);
      
      // Newly born crystals always have length 30
      crystals[tokenId] = CrystalInfo(30, gen, sym, seed);      
      _safeMint(msg.sender, tokenId);
    }

    function safeMint(uint256 spiralTokenId, uint8 gen) external payable nonReentrant {
      // Ensure user owns the spiralTokenID or has it staked
      (, address spiralOwner) = ISpiralStaking(spiralStaking).stakedTokenOwners(spiralTokenId);
      require(IImpishSpiral(spirals).ownerOf(spiralTokenId) == msg.sender 
          || spiralOwner == msg.sender, "NotOwnerOrStaker");

      // Make sure this gen has not been minted for the spiral
      require(mintedSpirals[spiralTokenId][gen].minted == false, "AlreadyMintedThisGen");

      // Only the first gen is free
      require(gen <= 5, "InvalidGen");

      // Make sure there was enough ETH sent.
      // Mint prices are [0, 0.01 ether, 0.1 ether, 1 ether, 10 ether];
      uint256 mintPrice = 0;
      if (gen > 0) {
        mintPrice = 0.01 ether * uint256(10) ** uint256(gen-1);
      }
      require (msg.value == mintPrice, "NotEnoughEth");

      // All the ETH is dev fee
      (bool success, ) = owner().call{value: address(this).balance}("");
      require(success, "TransferFailed");

      // Mark this spiral's gen as minted. The tokenID will be the current tokenId counter
      mintedSpirals[spiralTokenId][gen] = MintedSpiralInfo(true, _tokenIdCounter);
      _mintCrystal(gen);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

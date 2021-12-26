// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract IImpishSpiral is IERC721 {}

abstract contract ISpiralBits is IERC20 {
    function mintSpiralBits(address to, uint256 amount) public virtual;
}

contract SpiralStaking is IERC721Receiver, ReentrancyGuard {
    // How many spiral bits per second are awarded to a staked spiral
    uint256 constant public SPIRALBITS_PER_SECOND = 100;

    IImpishSpiral public impishspiral;
    ISpiralBits public spiralbits;

    struct StakedSpirals {
        uint32 numSpirals;
        uint64 lastClaimTime;
        uint128 claimedSpiralBits;
    }

    mapping(address => StakedSpirals) public stakedSpirals;
    
    // Mapping of Spiral TokenID => Address that staked it.
    mapping(uint256 => address) public isSpiralStaked;

    constructor(address _impishspiral, address _spiralbits) {
        impishspiral = IImpishSpiral(_impishspiral);
        spiralbits = ISpiralBits(_spiralbits);
    }

    function _claimSpiralBits(address owner) internal {
        // Claim all the spiralbits so far
        uint256 spiralBitsToClaim = stakedSpirals[owner].numSpirals * uint256(uint64(block.timestamp) - stakedSpirals[owner].lastClaimTime) * SPIRALBITS_PER_SECOND;
        
        stakedSpirals[owner].claimedSpiralBits += uint128(spiralBitsToClaim);
        stakedSpirals[owner].lastClaimTime = uint64(block.timestamp);
    }

    function stakeSpirals(uint32[] calldata tokenIds) external nonReentrant {
        // Update the staked spirals
        if (stakedSpirals[msg.sender].numSpirals > 0) {
            // User already has some Spirals staked
            _claimSpiralBits(msg.sender);
        }
        
        for (uint32 i; i < tokenIds.length; i++) {
            uint256 tokenId = uint256(tokenIds[i]);
            require(impishspiral.ownerOf(tokenId) == msg.sender, "DontOwnToken");
            require(isSpiralStaked[tokenId] == address(0), "Already Staked");

            // Add the spiral to staked owner list to keep track of staked tokens
            transferSpiralIn(tokenId, msg.sender);
        }        
    }

    // Unstake a spiral
    function unstakeSpirals(uint32[] calldata tokenIds, bool withdraw) external nonReentrant {
        _claimSpiralBits(msg.sender);
        
        for (uint32 i; i < tokenIds.length; i++) {
            uint256 tokenId = uint256(tokenIds[i]);
            require(isSpiralStaked[tokenId] == msg.sender, "NotYours");

            // Add the spiral to staked owner list to keep track of staked tokens
            transferSpiralOut(tokenId, msg.sender);
        }

        if (withdraw) {
            uint256 spiralBitsToMint = stakedSpirals[msg.sender].claimedSpiralBits;
            stakedSpirals[msg.sender].claimedSpiralBits = 0;

            // Mint and send the new spiral bits to the owners
            spiralbits.mintSpiralBits(msg.sender, spiralBitsToMint);
        }
    }

    // Claim the SpiralBits and Withdraw
    function withdrawSpiralBits() external nonReentrant {
        // First, claim any spiralbits
        _claimSpiralBits(msg.sender);

        uint256 spiralBitsToMint = stakedSpirals[msg.sender].claimedSpiralBits;
        stakedSpirals[msg.sender].claimedSpiralBits = 0;

        // Mint and send the new spiral bits to the owners
        spiralbits.mintSpiralBits(msg.sender, spiralBitsToMint);
    }

    function transferSpiralIn(uint256 tokenId, address owner) internal {
        _addTokenToOwnerEnumeration(owner, tokenId);
        isSpiralStaked[tokenId] = owner;

        // Add this spiral to the staked struct
        stakedSpirals[msg.sender].numSpirals += 1;
        stakedSpirals[msg.sender].lastClaimTime = uint64(block.timestamp);

        // Transfer the actual Spiral NFT to ourself.
        impishspiral.safeTransferFrom(msg.sender, address(this), tokenId);
    }

    function transferSpiralOut(uint256 tokenId, address owner) internal {
        _removeTokenFromOwnerEnumeration(owner, tokenId);

        delete isSpiralStaked[tokenId];

        // Remove this spiral from the staked struct
        stakedSpirals[msg.sender].numSpirals -= 1;
        stakedSpirals[msg.sender].lastClaimTime = uint64(block.timestamp);

        // Transfer the spiral out
        impishspiral.safeTransferFrom(address(this), owner, tokenId);
    }

    // =========
    // Keep track of staked spirals
    // =========
    // Mapping from owner to list of owned token IDs
    mapping(address => mapping(uint256 => uint256)) private _ownedTokens;

    // Mapping from token ID to index of the owner tokens list
    mapping(uint256 => uint256) private _ownedTokensIndex;

    // Returns a list of token Ids owned by _owner.
    function walletOfOwner(address _owner) public view
        returns (uint256[] memory) {
        uint256 tokenCount = stakedSpirals[_owner].numSpirals;

        if (tokenCount == 0) {
            // Return an empty array
            return new uint256[](0);
        }

        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return result;
    }

    /**
     * @dev See {IERC721Enumerable-tokenOfOwnerByIndex}.
     */
    function tokenOfOwnerByIndex(address owner, uint256 index) public view virtual returns (uint256) {
        require(index < stakedSpirals[owner].numSpirals, "ERC721Enumerable: owner index out of bounds");
        return _ownedTokens[owner][index];
    }


    /**
     * @dev Private function to add a token to this extension's ownership-tracking data structures.
     * @param owner address representing the owner of the given token ID
     * @param tokenId uint256 ID of the token to be added to the tokens list of the given address
     */
    function _addTokenToOwnerEnumeration(address owner, uint256 tokenId) private {
        uint256 length = stakedSpirals[owner].numSpirals;
        _ownedTokens[owner][length] = tokenId;
        _ownedTokensIndex[tokenId] = length;
    }

    /**
     * @dev Private function to remove a token from this extension's ownership-tracking data structures. Note that
     * while the token is not assigned a new owner, the `_ownedTokensIndex` mapping is _not_ updated: this allows for
     * gas optimizations e.g. when performing a transfer operation (avoiding double writes).
     * This has O(1) time complexity, but alters the order of the _ownedTokens array.
     * @param from address representing the previous owner of the given token ID
     * @param tokenId uint256 ID of the token to be removed from the tokens list of the given address
     */
    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId) private {
        // To prevent a gap in from's tokens array, we store the last token in the index of the token to delete, and
        // then delete the last slot (swap and pop).

        uint256 lastTokenIndex = stakedSpirals[from].numSpirals - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        // When the token to delete is the last token, the swap operation is unnecessary
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];

            _ownedTokens[from][tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
            _ownedTokensIndex[lastTokenId] = tokenIndex; // Update the moved token's index
        }

        // This also deletes the contents at the last position of the array
        delete _ownedTokensIndex[tokenId];
        delete _ownedTokens[from][lastTokenIndex];
    }

    // Function that marks this contract can accept incoming NFT transfers
    function onERC721Received(address, address, uint256 , bytes calldata) public view returns(bytes4) {
        // Only accept NFT transfers from RandomWalkNFT
        require(msg.sender == address(impishspiral), "NFT not recognized");

        // Return this value to accept the NFT
        return IERC721Receiver.onERC721Received.selector;
    }
}
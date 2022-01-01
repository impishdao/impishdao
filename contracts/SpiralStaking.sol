// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract IImpishSpiral is IERC721 {}
abstract contract IRandomWalkNFT is IERC721 {}

abstract contract IStakingContract {
    uint256 public totalStaked;
}

abstract contract ISpiralBits is IERC20 {
    function mintSpiralBits(address to, uint256 amount) public virtual;
}

contract SpiralStaking is IERC721Receiver, ReentrancyGuard {
    // How many spiral bits per second are awarded to a staked spiral
    // 0.001 SPIRALBITS per second. (1 SPIRALBIT per 1000 seconds)
    uint256 constant public SPIRALBITS_PER_SECOND = 1 ether / 1000; 

    // We're staking this NFT in this contract
    IImpishSpiral public impishspiral;

    // The token that is being issued for staking
    ISpiralBits public spiralbits;

    // The other staking contract - To calculate bonuses
    IRandomWalkNFT public rwnft;

    // Total number of NFTs staked in this contract
    uint256 public totalStaked;

    constructor(address _impishspiral, address _spiralbits, address _rwnft) {
        impishspiral = IImpishSpiral(_impishspiral);
        spiralbits = ISpiralBits(_spiralbits);
        rwnft = IRandomWalkNFT(_rwnft);
    }

    function _claimSpiralBits(address owner) internal {
        // Claim all the spiralbits so far
        uint256 spiralBitsToClaim = stakedSpirals[owner].numNFTsStaked * uint256(uint64(block.timestamp) - stakedSpirals[owner].lastClaimTime) * SPIRALBITS_PER_SECOND;
        
        stakedSpirals[owner].claimedSpiralBits += uint128(spiralBitsToClaim);
        stakedSpirals[owner].lastClaimTime = uint64(block.timestamp);
    }

    // Stake a list of Spiral tokenIDs. The msg.sender needs to own the tokenIds, and the tokens
    // are staked with msg.sender as the owner
    function stakeNFTs(uint32[] calldata tokenIds) external {
        stakeNFTsForOwner(tokenIds, msg.sender);
    }

    // Stake the spirals and make them withdrawable by the owner. The msg.sender still needs to own
    // the spirals that are being staked.
    // This is used by aggregator contracts.
    function stakeNFTsForOwner(uint32[] calldata tokenIds, address owner) public nonReentrant {
        require(tokenIds.length > 0, "NoTokens");
        // Update the staked spirals
        if (stakedSpirals[owner].numNFTsStaked > 0) {
            // User already has some Spirals staked
            _claimSpiralBits(owner);
        }
        
        for (uint32 i; i < tokenIds.length; i++) {
            uint256 tokenId = uint256(tokenIds[i]);
            require(impishspiral.ownerOf(tokenId) == msg.sender, "DontOwnToken");

            // Add the spiral to staked owner list to keep track of staked tokens
            _addTokenToOwnerEnumeration(owner, tokenId);
            stakedTokenOwners[tokenId] = owner;

            // Add this spiral to the staked struct
            stakedSpirals[owner].numNFTsStaked += 1;
            stakedSpirals[owner].lastClaimTime = uint64(block.timestamp);

            // Transfer the actual Spiral NFT to ourself.
            impishspiral.safeTransferFrom(msg.sender, address(this), tokenId);
        }
        totalStaked += tokenIds.length;
    }

    // Unstake a spiral. If withdraw is true, then SPIRALBITS are also claimed and sent
    function unstakeNFTs(uint32[] calldata tokenIds, bool withdraw) external nonReentrant {
        _claimSpiralBits(msg.sender);
        
        for (uint32 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = uint256(tokenIds[i]);
            require(impishspiral.ownerOf(tokenId) == address(this), "NotStaked");
            require(stakedTokenOwners[tokenId] == msg.sender, "NotYours");

            // Remove the spiral -> staked owner list to keep track of staked tokens
             _removeTokenFromOwnerEnumeration(msg.sender, tokenId);

            delete stakedTokenOwners[tokenId];

            // Remove this spiral from the staked struct
            stakedSpirals[msg.sender].numNFTsStaked -= 1;
            stakedSpirals[msg.sender].lastClaimTime = uint64(block.timestamp);

            // Transfer the spiral out
            impishspiral.safeTransferFrom(address(this), msg.sender, tokenId);
        }
        totalStaked -= tokenIds.length;

        if (withdraw) {
            uint256 spiralBitsToMint = stakedSpirals[msg.sender].claimedSpiralBits;
            stakedSpirals[msg.sender].claimedSpiralBits = 0;

            // TODO: Calculate bonus

            // Mint and send the new spiral bits to the owners
            spiralbits.mintSpiralBits(msg.sender, spiralBitsToMint);
        }
    }

    // =========
    // Keep track of staked NFTs
    // =========
    struct StakedNFTs {
        uint32 numNFTsStaked;       // Number of NFTs staked by this owner
        uint64 lastClaimTime;       // Last timestamp that the rewards were accumulated into claimedSpiralBits
        uint128 claimedSpiralBits;  // Already claimed (but not withdrawn) spiralBits before lastClaimTime
    }

    // Mapping from owner to list of owned token IDs
    // origina owned address => (index => tokenId)
    mapping(address => mapping(uint256 => uint256)) private _ownedTokens;

    // Mapping from token ID to index of the owner tokens list
    mapping(uint256 => uint256) private _ownedTokensIndex;

    // Mapping of Spiral TokenID => Address that staked it.
    mapping(uint256 => address) public stakedTokenOwners;

    // Address that staked the token => Token Accounting
    mapping(address => StakedNFTs) public stakedSpirals;
    
    // Returns a list of token Ids owned by _owner.
    function walletOfOwner(address _owner) public view
        returns (uint256[] memory) {
        uint256 tokenCount = stakedSpirals[_owner].numNFTsStaked;

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
        require(index < stakedSpirals[owner].numNFTsStaked, "ERC721Enumerable: owner index out of bounds");
        return _ownedTokens[owner][index];
    }

    /**
     * @dev Private function to add a token to this extension's ownership-tracking data structures.
     * @param owner address representing the owner of the given token ID
     * @param tokenId uint256 ID of the token to be added to the tokens list of the given address
     */
    function _addTokenToOwnerEnumeration(address owner, uint256 tokenId) private {
        uint256 length = stakedSpirals[owner].numNFTsStaked;
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

        uint256 lastTokenIndex = stakedSpirals[from].numNFTsStaked - 1;
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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Goals of Staking V2
// 1. Stake RandomWalkNFT, Spiral, Crystals, SPIRALBITS and IMPISH
// 2. Allow Crystals to grow - both size and target symmetry
// 3. Allow Spirals to claim win if Spiral game ends
// 4. Allow listing on marketplace while staked

// A note on how TokenIDs work.
// TokenIDs stored inside the contract have to be >1M.
// 1M+ -> RandomWalkNFT
// 2M+ -> Spiral
// 3M+ -> Staked Crystal that is growing
// 4M+ -> Fully grown crystal that is earning SPIRALBITS

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakingV2 is IERC721Receiver, ReentrancyGuard, Ownable {
  // Global reward for all SPIRALBITS staked per second
  //  TODO
  uint256 public SPIRALBITS_STAKING_EMISSION_PER_SEC = 1 ether;

  // Global reward for all IMPISH staked per second
  //  TODO
  uint256 public IMPISH_STAKING_EMISSION_PER_SEC = 1 ether;

  // How many spiral bits per second are awarded to a staked spiral
  // 0.167 SPIRALBITS per second. (10 SPIRALBIT per 60 seconds)
  uint256 public constant SPIRALBITS_PER_SECOND_PER_SPIRAL = 0.167 ether;

  // How many spiral bits per second are awarded to a staked RandomWalkNFTs
  // 0.0167 SPIRALBITS per second. (1 SPIRALBIT per 60 seconds)
  uint256 public constant SPIRALBITS_PER_SECOND_PER_RW = 0.0167 ether;

  // Do the internal accounting update for the address
  function _update(address owner) internal {
    uint256 rewardsAccumulated = 0;
    uint256 totalDuration = 0;

    for (uint256 i = stakedNFTsAndTokens[owner].lastClaimEpoch; i < epochs.length; i++) {
      // Accumulate the durations, so we can add the NFT rewards too
      totalDuration += epochs[i].epochDurationSec;

      // Accumulate spiralbits reward
      rewardsAccumulated +=
        (SPIRALBITS_STAKING_EMISSION_PER_SEC *
          epochs[i].epochDurationSec *
          stakedNFTsAndTokens[owner].spiralBitsStaked) /
        (uint256(epochs[i].totalSpiralBitsStakedE18) * 1 ether);

      // accumulate impish rewards
      rewardsAccumulated +=
        (IMPISH_STAKING_EMISSION_PER_SEC * epochs[i].epochDurationSec * stakedNFTsAndTokens[owner].impishStaked) /
        (uint256(epochs[i].totalImpishStakedE18) * 1 ether);
    }

    rewardsAccumulated += totalDuration * SPIRALBITS_PER_SECOND_PER_SPIRAL * stakedNFTsAndTokens[owner].numSpiralsStaked;
    rewardsAccumulated += totalDuration * SPIRALBITS_PER_SECOND_PER_RW * stakedNFTsAndTokens[owner].numRWStaked;
    // TODO: Reward for Fully Grown Crystals

    stakedNFTsAndTokens[owner].lastClaimEpoch = uint16(epochs.length - 1);
    stakedNFTsAndTokens[owner].claimedSpiralBits += uint96(rewardsAccumulated);
  }

  // -------------------
  // Rewards Epochs
  // -------------------
  // Rewards for ERC20 tokens are different from Rewards for NFTs.
  // Staked NFTs earn a fixed reward per time, but staked ERC20 earn a reward
  // proportional to how many other ERC20 of the same type are staked.
  // That is, there is a global emission per ERC20, that is split evenly among all
  // staked ERC20.
  // Therefore, we need to track how many of the total ERC20s were staked for each epoch
  // Note that if the amount of ERC20 staked by a user changes (via deposit or withdraw), then
  // the user's balance needs to be updated
  struct RewardEpoch {
    uint32 epochDurationSec; // Total seconds that this epoch lasted
    uint32 totalSpiralBitsStakedE18; // Total SPIRALBITS staked across all accounts in whole uints for this Epoch
    uint32 totalImpishStakedE18; // Total IMPISH tokens staked across all accounts in whole units for this Epoch
  }
  RewardEpoch[] public epochs; // List of epochs
  uint32 public lastEpochTime; // Last epoch ended at this time

  // Add to epoch. spiralBitsChanged and impishChanged can both be negative
  function _addEpoch(int256 spiralBitsChanged, int256 impishChanged) internal {
    uint256 lastEpochIndex = epochs.length - 1;

    RewardEpoch memory newEpoch = RewardEpoch({
      epochDurationSec: uint32(block.timestamp - lastEpochTime),
      totalSpiralBitsStakedE18: uint32(
        int32(epochs[lastEpochIndex].totalSpiralBitsStakedE18) + int32(spiralBitsChanged / 1 ether)
      ),
      totalImpishStakedE18: uint32(int32(epochs[lastEpochIndex].totalImpishStakedE18) + int32(impishChanged / 1 ether))
    });

    // Add to array
    epochs.push(newEpoch);
    lastEpochTime = uint32(block.timestamp);
  }

  // -------------------
  // Keep track of staked NFTs
  // -------------------
  struct StakedNFTAndTokens {
    uint16 numRWStaked;
    uint16 numSpiralsStaked;
    uint16 numGrowingCrystalsStaked;
    uint16 numFullCrystalsStaked;
    uint16 lastClaimEpoch; // Last Epoch number the rewards were accumulated into claimedSpiralBits
    uint96 spiralBitsStaked; // Total number of SPIRALBITS staked
    uint96 impishStaked; // Total number of IMPISH tokens staked
    uint96 claimedSpiralBits; // Already claimed (but not withdrawn) spiralBits before lastClaimTime
    mapping(uint256 => uint256) ownedTokens; // index => tokenId
  }

  struct TokenIdInfo {
    uint256 ownedTokensIndex;
    address owner;
  }

  // Mapping of Spiral TokenID => Address that staked it.
  mapping(uint256 => TokenIdInfo) public stakedTokenOwners;

  // Address that staked the token => Token Accounting
  mapping(address => StakedNFTAndTokens) public stakedNFTsAndTokens;

  function _totalTokenCountStaked(address _owner) internal view returns (uint256) {
    return
      stakedNFTsAndTokens[_owner].numRWStaked +
      stakedNFTsAndTokens[_owner].numSpiralsStaked +
      stakedNFTsAndTokens[_owner].numGrowingCrystalsStaked +
      stakedNFTsAndTokens[_owner].numFullCrystalsStaked;
  }

  // Returns a list of token Ids owned by _owner.
  function walletOfOwner(address _owner) public view returns (uint256[] memory) {
    uint256 tokenCount = _totalTokenCountStaked(_owner);

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
    require(index < _totalTokenCountStaked(owner), "OwnerIndex out of bounds");
    return stakedNFTsAndTokens[owner].ownedTokens[index];
  }

  /**
   * @dev Private function to add a token to this extension's ownership-tracking data structures.
   * @param owner address representing the owner of the given token ID
   * @param tokenId uint256 ID of the token to be added to the tokens list of the given address
   */
  function _addTokenToOwnerEnumeration(address owner, uint256 tokenId) private {
    uint256 length = _totalTokenCountStaked(owner);
    stakedNFTsAndTokens[owner].ownedTokens[length] = tokenId;
    stakedTokenOwners[tokenId].ownedTokensIndex = length;
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

    uint256 lastTokenIndex = _totalTokenCountStaked(from) - 1;
    uint256 tokenIndex = stakedTokenOwners[tokenId].ownedTokensIndex;

    // When the token to delete is the last token, the swap operation is unnecessary
    if (tokenIndex != lastTokenIndex) {
      uint256 lastTokenId = stakedNFTsAndTokens[from].ownedTokens[lastTokenIndex];

      stakedNFTsAndTokens[from].ownedTokens[tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
      stakedTokenOwners[lastTokenId].ownedTokensIndex = tokenIndex; // Update the moved token's index
    }

    // This also deletes the contents at the last position of the array
    delete stakedTokenOwners[tokenId];
    delete stakedNFTsAndTokens[from].ownedTokens[lastTokenIndex];
  }

  // -------------------
  // Overrides that allow accepting NFTs and ERC20s
  // -------------------
  // Function that marks this contract can accept incoming NFT transfers
  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) public pure returns (bytes4) {
    // Return this value to accept the NFT
    return IERC721Receiver.onERC721Received.selector;
  }
}

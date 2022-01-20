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

abstract contract ISpiralBits is IERC20 {
  function mintSpiralBits(address to, uint256 amount) public virtual;
}

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

  // We're staking this NFT in this contract
  IERC721 public randomWalkNFT;
  IERC721 public impishspiral;
  IERC721 public crystals;

  // The token that is being issued for staking
  ISpiralBits public spiralbits;

  // The Impish Token
  IERC20 public impish;

  constructor() {
    // To make accounting easier, we put a dummy epoch here
    epochs.push(RewardEpoch({epochDurationSec: 0, totalSpiralBitsStaked: 0, totalImpishStaked: 0}));

    // And set up the first epoch at position 1.
    // We start off the totals at 1 to make the math easier (We don't need
    // to check divide by 0)
    epochs.push(RewardEpoch({epochDurationSec: 0, totalSpiralBitsStaked: 1, totalImpishStaked: 1}));
  }

  function stakeSpiralBits(uint256 amount) external nonReentrant {
    require(amount > 0, "Need SPIRALBITS");

    // Transfer the SpiralBits in. If amount is bad or user doesn't have enoug htokens, this will fail.
    spiralbits.transferFrom(msg.sender, address(this), amount);

    // Update the owner's rewards. The newly added epoch doesn't matter, because it's duration is 0.
    // This has to be done before
    _updateRewards(msg.sender);

    // Create a new epoch with the additional spiralbits. This starts a new Epoch,
    // but it has duration = 0, since it just started
    _addEpoch(int256(amount), 0);

    // Spiralbits accounting
    stakedNFTsAndTokens[msg.sender].spiralBitsStaked += uint96(amount);
  }

  function unstakeSpiralBits(bool claimReward) external nonReentrant {
    uint256 amount = stakedNFTsAndTokens[msg.sender].spiralBitsStaked;
    require(amount > 0, "No SPIRALBITS to Unstake");

    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(msg.sender);

    // Create a new epoch with the removed impish. This starts a new Epoch,
    // but it has duration = 0, since it just started
    _addEpoch(-int256(amount), 0);

    // Impish accounting
    stakedNFTsAndTokens[msg.sender].spiralBitsStaked = 0;

    // Transfer impish out.
    spiralbits.transfer(msg.sender, amount);

    if (claimReward) {
      _claimRewards(msg.sender);
    }
  }

  function stakeImpish(uint256 amount) external nonReentrant {
    require(amount > 0, "Need IMPISH");

    // Transfer the SpiralBits in. If amount is bad or user doesn't have enoug htokens, this will fail.
    impish.transferFrom(msg.sender, address(this), amount);

    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(msg.sender);

    // Create a new epoch with the additional impish. This starts a new Epoch,
    // but it has duration = 0, since it just started
    _addEpoch(0, int256(amount));

    // Impish accounting
    stakedNFTsAndTokens[msg.sender].impishStaked += uint96(amount);
  }

  function unstakeImpish(bool claimReward) external nonReentrant {
    uint256 amount = stakedNFTsAndTokens[msg.sender].impishStaked;
    require(amount > 0, "No IMPISH to Unstake");

    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(msg.sender);

    // Create a new epoch with the removed impish. This starts a new Epoch,
    // but it has duration = 0, since it just started
    _addEpoch(0, -int256(amount));

    // Impish accounting
    stakedNFTsAndTokens[msg.sender].impishStaked = 0;

    // Transfer impish out.
    impish.transfer(msg.sender, amount);

    if (claimReward) {
      _claimRewards(msg.sender);
    }
  }

  function stakeNFTsForOwner(
    uint32[] calldata rwTokenIDs,
    uint32[] calldata spiralTokenIds,
    uint32[] calldata growingCrystalTokenIds,
    uint32[] calldata fullCrystalTokenIds,
    address owner
  ) external nonReentrant {
    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(owner);

    // RandomWalkNFTs
    uint256 tokenIdMultiplier = 1_000_000;
    for (uint256 i = 0; i < rwTokenIDs.length; i++) {
      _stakeNFT(randomWalkNFT, owner, uint256(rwTokenIDs[i]), tokenIdMultiplier);

      // Add this spiral to the staked struct
      stakedNFTsAndTokens[owner].numRWStaked += 1;
    }

    // Spirals
    tokenIdMultiplier = 2_000_000;
    for (uint256 i = 0; i < spiralTokenIds.length; i++) {
      _stakeNFT(impishspiral, owner, uint256(spiralTokenIds[i]), tokenIdMultiplier);

      // Add this spiral to the staked struct
      stakedNFTsAndTokens[owner].numSpiralsStaked += 1;
    }

    // Crystals that are growing
    tokenIdMultiplier = 3_000_000;
    for (uint256 i = 0; i < growingCrystalTokenIds.length; i++) {
      _stakeNFT(crystals, owner, uint256(growingCrystalTokenIds[i]), tokenIdMultiplier);

      // Add this spiral to the staked struct
      stakedNFTsAndTokens[owner].numGrowingCrystalsStaked += 1;
    }

    // Crystals that are growing
    tokenIdMultiplier = 4_000_000;
    for (uint256 i = 0; i < fullCrystalTokenIds.length; i++) {
      _stakeNFT(crystals, owner, uint256(fullCrystalTokenIds[i]), tokenIdMultiplier);

      // Add this spiral to the staked struct
      stakedNFTsAndTokens[owner].numFullCrystalsStaked += 1;
    }
  }

  // ---------------------
  // Internal Functions
  // ---------------------

  // Claim the pending rewards
  function _claimRewards(address owner) internal {
    uint256 rewardsPending = stakedNFTsAndTokens[owner].claimedSpiralBits;

    // If there are any rewards,
    if (rewardsPending > 0) {
      // Mark rewards as claimed
      stakedNFTsAndTokens[owner].claimedSpiralBits = 0;

      // Mint new spiralbits directly to the claimer
      spiralbits.mintSpiralBits(owner, rewardsPending);
    }
  }

  // Stake an NFT
  function _stakeNFT(
    IERC721 nft,
    address owner,
    uint256 tokenId,
    uint256 tokenIdMultiplier
  ) internal {
    require(nft.ownerOf(tokenId) == msg.sender, "DontOwnNFT");

    uint256 contractRWTokenId = tokenIdMultiplier + tokenId;

    // Add the spiral to staked owner list to keep track of staked tokens
    _addTokenToOwnerEnumeration(owner, contractRWTokenId);
    stakedTokenOwners[contractRWTokenId].owner = owner;

    // Transfer the actual NFT to this staking contract.
    nft.safeTransferFrom(msg.sender, address(this), tokenId);
  }

  // Do the internal accounting update for the address
  function _updateRewards(address owner) internal {
    // Mark as claimed until the last epoch.
    uint256 lastClaimedEpoch = stakedNFTsAndTokens[owner].lastClaimEpoch;
    stakedNFTsAndTokens[owner].lastClaimEpoch = uint32(epochs.length - 1);

    // Return if there is nothing to update. We've already updated the lastClaimEpoch,
    // which will happen for new stakers.
    if (lastClaimedEpoch == 0) {
      return;
    }

    // Update the current epoch, to bring all the rewards up to date for this address
    _updateCurrentEpoch();

    uint256 rewardsAccumulated = 0;
    uint256 totalDuration = 0;

    for (uint256 i = lastClaimedEpoch + 1; i < epochs.length; i++) {
      // Accumulate the durations, so we can add the NFT rewards too
      totalDuration += epochs[i].epochDurationSec;

      // Accumulate spiralbits reward
      rewardsAccumulated +=
        (SPIRALBITS_STAKING_EMISSION_PER_SEC *
          epochs[i].epochDurationSec *
          stakedNFTsAndTokens[owner].spiralBitsStaked) /
        uint256(epochs[i].totalSpiralBitsStaked);

      // accumulate impish rewards
      rewardsAccumulated +=
        (IMPISH_STAKING_EMISSION_PER_SEC * epochs[i].epochDurationSec * stakedNFTsAndTokens[owner].impishStaked) /
        uint256(epochs[i].totalImpishStaked);
    }

    rewardsAccumulated +=
      totalDuration *
      SPIRALBITS_PER_SECOND_PER_SPIRAL *
      stakedNFTsAndTokens[owner].numSpiralsStaked;
    rewardsAccumulated += totalDuration * SPIRALBITS_PER_SECOND_PER_RW * stakedNFTsAndTokens[owner].numRWStaked;

    // TODO: Reward for Fully Grown Crystals

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
    uint96 totalSpiralBitsStaked; // Total SPIRALBITS staked across all accounts in whole uints for this Epoch
    uint96 totalImpishStaked; // Total IMPISH tokens staked across all accounts in whole units for this Epoch
  }
  RewardEpoch[] public epochs; // List of epochs
  uint32 public lastEpochTime; // Last epoch ended at this time

  function _updateCurrentEpoch() internal {
    uint256 lastEpochIndex = epochs.length - 1;
    epochs[lastEpochIndex].epochDurationSec += (uint32(block.timestamp) - lastEpochTime);
    lastEpochTime = uint32(block.timestamp);
  }

  // Add a new empty epoch. spiralBitsChanged and impishChanged can both be negative
  function _addEpoch(int256 spiralBitsChanged, int256 impishChanged) internal {
    // Sanity check. Can't add epoch without having the epochs up-to-date
    require(lastEpochTime == uint32(block.timestamp), "EpochNotUpdated");

    uint256 lastEpochIndex = epochs.length - 1;

    RewardEpoch memory newEpoch = RewardEpoch({
      epochDurationSec: 0,
      totalSpiralBitsStaked: uint96(int96(epochs[lastEpochIndex].totalSpiralBitsStaked) + int96(spiralBitsChanged)),
      totalImpishStaked: uint96(int96(epochs[lastEpochIndex].totalImpishStaked) + int96(impishChanged))
    });

    // Add to array
    epochs.push(newEpoch);
  }

  // -------------------
  // Keep track of staked NFTs
  // -------------------
  struct StakedNFTAndTokens {
    uint16 numRWStaked;
    uint16 numSpiralsStaked;
    uint16 numGrowingCrystalsStaked;
    uint16 numFullCrystalsStaked;
    uint32 lastClaimEpoch; // Last Epoch number the rewards were accumulated into claimedSpiralBits. Cannot be 0.
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

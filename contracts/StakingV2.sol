// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Goals of Staking V2
// 1. Stake RandomWalkNFT, Spiral, Crystals, SPIRALBITS and IMPISH
// 2. Allow Crystals to grow - both size and target symmetry
// 3. Allow Spirals to claim win if Spiral game ends
// 4. Allow listing on marketplace while staked

// A note on how TokenIDs work.
// TokenIDs stored inside the contract have to be >1M
// 1M+ -> RandomWalkNFT
// 2M+ -> Spiral
// 3M+ -> Staked Crystal that is growing
// 4M+ -> Fully grown crystal that is earning SPIRALBITS

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./ImpishCrystal.sol";
import "./ImpishSpiral.sol";
import "./SpiralBits.sol";

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
  ImpishSpiral public impishspiral;
  ImpishCrystal public crystals;

  // The token that is being issued for staking
  SpiralBits public spiralbits;

  // The Impish Token
  IERC20 public impish;

  constructor(address _crystals) {
    crystals = ImpishCrystal(_crystals);
    impishspiral = ImpishSpiral(crystals.spirals());
    randomWalkNFT = IERC721(impishspiral._rwNFT());

    spiralbits = SpiralBits(crystals.SpiralBits());
    impish = IERC20(impishspiral._impishDAO());

    // To make accounting easier, we put a dummy epoch here
    epochs.push(RewardEpoch({epochDurationSec: 0, totalSpiralBitsStaked: 0, totalImpishStaked: 0}));

    // Authorize spiralbits to be spent from this contact by the Crystals contracts, used to grow crystals
    spiralbits.approve(_crystals, 2_000_000_000 ether);

    lastEpochTime = uint32(block.timestamp);
  }

  function stakeSpiralBits(uint256 amount) external nonReentrant {
    require(amount > 0, "Need SPIRALBITS");

    // Update the owner's rewards. The newly added epoch doesn't matter, because it's duration is 0.
    // This has to be done before
    _updateRewards(msg.sender);

    // Transfer the SpiralBits in. If amount is bad or user doesn't have enoug htokens, this will fail.
    spiralbits.transferFrom(msg.sender, address(this), amount);

    // Spiralbits accounting
    stakedNFTsAndTokens[msg.sender].spiralBitsStaked += uint96(amount);
  }

  function unstakeSpiralBits(bool claimReward) external nonReentrant {
    uint256 amount = stakedNFTsAndTokens[msg.sender].spiralBitsStaked;
    require(amount > 0, "No SPIRALBITS to Unstake");

    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(msg.sender);

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

    // Impish accounting
    stakedNFTsAndTokens[msg.sender].impishStaked += uint96(amount);
  }

  function unstakeImpish(bool claimReward) external nonReentrant {
    uint256 amount = stakedNFTsAndTokens[msg.sender].impishStaked;
    require(amount > 0, "No IMPISH to Unstake");

    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(msg.sender);

    // Impish accounting
    stakedNFTsAndTokens[msg.sender].impishStaked = 0;

    // Transfer impish out.
    impish.transfer(msg.sender, amount);

    if (claimReward) {
      _claimRewards(msg.sender);
    }
  }

  function stakeNFTsForOwner(uint32[] calldata contractTokenIds, address owner) external nonReentrant {
    // Update the owner's rewards first. This also updates the current epoch, since nothing has changed yet.
    _updateRewards(owner);

    for (uint256 i = 0; i < contractTokenIds.length; i++) {
      require(contractTokenIds[i] > 1_000_000, "UseContractTokenIDs");
      uint32 nftType = contractTokenIds[i] / 1_000_000;
      uint32 tokenId = contractTokenIds[i] % 1_000_000;

      if (nftType == 1) {
        _stakeNFT(randomWalkNFT, owner, uint256(tokenId), 1_000_000);

        // Add this RWNFT to the staked struct
        stakedNFTsAndTokens[owner].numRWStaked += 1;
      } else if (nftType == 2) {
        _stakeNFT(impishspiral, owner, uint256(tokenId), 2_000_000);

        // Add this spiral to the staked struct
        stakedNFTsAndTokens[owner].numSpiralsStaked += 1;
      } else if (nftType == 3) {
        // Crystals that are growing
        _stakeNFT(crystals, owner, uint256(tokenId), 3_000_000);

        // Add this crystal (Growing) to the staked struct
        stakedNFTsAndTokens[owner].numGrowingCrystalsStaked += 1;
      } else if (nftType == 4) {
        // Crystals that are growing
        _stakeNFT(crystals, owner, uint256(tokenId), 4_000_000);

        // Add this crystal (fully grown) to the staked struct
        stakedNFTsAndTokens[owner].numFullCrystalsStaked += 1;
      } else {
        revert("InvalidNFTType");
      }
    }
  }

  // TODO: Unstake NFTs
  // {
  //    TODO: Delete crystalTargetSym when unstaking growing crystal
  // }

  // ---------------------
  // Internal Functions
  // ---------------------

  // Claim the pending rewards
  function _claimRewards(address owner) internal {
    _updateRewards(owner);
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
    // First, see if we need to add an epoch.
    // We may not always need to, especially if the time elapsed is 0 (i.e., multiple tx in same block)
    if (block.timestamp > lastEpochTime) {
      _addEpoch();
    }

    // Return if there is nothing to update. We've already updated the lastClaimEpoch,
    // which will happen for new stakers.
    uint256 lastClaimedEpoch = stakedNFTsAndTokens[owner].lastClaimEpoch;
    stakedNFTsAndTokens[owner].lastClaimEpoch = uint32(epochs.length - 1);

    // If this owner is new, just return
    if (lastClaimedEpoch == 0) {
      return;
    }

    uint256 rewardsAccumulated = 0;
    uint256 totalDuration = 0;

    for (uint256 i = lastClaimedEpoch + 1; i < epochs.length; i++) {
      // Accumulate the durations, so we can add the NFT rewards too
      totalDuration += epochs[i].epochDurationSec;

      // Accumulate spiralbits reward
      if (epochs[i].totalSpiralBitsStaked > 0) {
        rewardsAccumulated +=
          (SPIRALBITS_STAKING_EMISSION_PER_SEC *
            uint256(epochs[i].epochDurationSec) *
            uint256(stakedNFTsAndTokens[owner].spiralBitsStaked)) /
          uint256(epochs[i].totalSpiralBitsStaked);
      }

      // accumulate impish rewards
      if (epochs[i].totalImpishStaked > 0) {
        rewardsAccumulated +=
          (IMPISH_STAKING_EMISSION_PER_SEC *
            uint256(epochs[i].epochDurationSec) *
            uint256(stakedNFTsAndTokens[owner].impishStaked)) /
          uint256(epochs[i].totalImpishStaked);
      }
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

  // Add a new epoch with the balances in the contract
  function _addEpoch() internal {
    // Sanity check. Can't add epoch without having the epochs up-to-date
    require(uint32(block.timestamp) > lastEpochTime, "TooNew");

    RewardEpoch memory newEpoch = RewardEpoch({
      epochDurationSec: uint32(block.timestamp) - lastEpochTime,
      totalSpiralBitsStaked: uint96(spiralbits.balanceOf(address(this))),
      totalImpishStaked: uint96(impish.balanceOf(address(this)))
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

  // Mapping of Contract TokenID => Address that staked it.
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

  // -----------------
  // Harvesting and Growing Crystals
  // -----------------
  mapping(uint32 => uint8) public crystalTargetSyms;

  function setCrystalTargetSym(uint32 crystalTokenId, uint8 targetSym) external nonReentrant {
    uint32 contractCrystalTokenId = crystalTokenId + 3_000_000;
    require(stakedTokenOwners[contractCrystalTokenId].owner == msg.sender, "NotYourCrystal");

    crystalTargetSyms[crystalTokenId] = targetSym;
  }

  function harvestCrystal(uint32 crystalTokenId) external nonReentrant {
    uint32 contractCrystalTokenId = crystalTokenId + 3_000_000;
    require(stakedTokenOwners[contractCrystalTokenId].owner == msg.sender, "NotYourCrystal");

    _updateRewards(msg.sender);

    // How many spiralbits are available to grow
    uint96 availableSpiralBits = stakedNFTsAndTokens[msg.sender].claimedSpiralBits;
    stakedNFTsAndTokens[msg.sender].claimedSpiralBits = 0;
    spiralbits.mintSpiralBits(address(this), availableSpiralBits);

    // Grow the crystal to max that it can
    (uint8 currentCrystalSize, , uint8 currentSym, , ) = crystals.crystals(crystalTokenId);
    if (currentCrystalSize < 100) {
      uint96 spiralBitsNeeded = uint96(
        crystals.SPIRALBITS_PER_SYM_PER_SIZE() * uint256(100 - currentCrystalSize) * uint256(currentSym)
      );
      if (availableSpiralBits > spiralBitsNeeded) {
        crystals.grow(crystalTokenId, 100 - currentCrystalSize);
        availableSpiralBits -= spiralBitsNeeded;
      }
    }

    // Next grow syms
    if (crystalTargetSyms[crystalTokenId] > 0 && crystalTargetSyms[crystalTokenId] > currentSym) {
      uint8 growSyms = crystalTargetSyms[crystalTokenId] - currentSym;

      uint96 spiralBitsNeeded = uint96(crystals.SPIRALBITS_PER_SYM() * uint256(growSyms));
      if (availableSpiralBits > spiralBitsNeeded) {
        crystals.addSym(crystalTokenId, growSyms);
        availableSpiralBits -= spiralBitsNeeded;
      }
    }

    // And then grow the Crystal again to max size if possible
    (currentCrystalSize, , currentSym, , ) = crystals.crystals(crystalTokenId);
    if (currentCrystalSize < 100) {
      uint96 spiralBitsNeeded = uint96(
        crystals.SPIRALBITS_PER_SYM_PER_SIZE() * uint256(100 - currentCrystalSize) * uint256(currentSym)
      );
      if (availableSpiralBits > spiralBitsNeeded) {
        crystals.grow(crystalTokenId, 100 - currentCrystalSize);
        availableSpiralBits -= spiralBitsNeeded;
      }
    }

    delete crystalTargetSyms[crystalTokenId];

    // TODO: Unstake growing crystal
    _removeTokenFromOwnerEnumeration(msg.sender, contractCrystalTokenId);
    stakedNFTsAndTokens[msg.sender].numGrowingCrystalsStaked -= 1;

    // TODO: Stake fully grown crystal
    uint256 contractFullyGrownTokenId = 4_000_000 + crystalTokenId;
    _addTokenToOwnerEnumeration(msg.sender, contractFullyGrownTokenId);
    stakedTokenOwners[contractFullyGrownTokenId].owner = msg.sender;
    stakedNFTsAndTokens[msg.sender].numFullCrystalsStaked += 1;

    // Burn any unused spiralbits and credit the user back, so we can harvest more crystals
    // instead of returning a large amount of SPIRALBITS back to the user here. 
    spiralbits.burn(availableSpiralBits);
    stakedNFTsAndTokens[msg.sender].claimedSpiralBits = availableSpiralBits;
  }

  // ------------------
  // Other functions
  // ------------------
  function claimSpiralWin(uint256 spiralTokenId) external nonReentrant {
    ImpishSpiral(address(impishspiral)).claimWin(spiralTokenId);

    // Send the ether to the Spiral's owner
    address spiralOwner = stakedTokenOwners[spiralTokenId + 2_000_000].owner;
    (bool success, ) = spiralOwner.call{value: address(this).balance}("");
    require(success, "Transfer failed.");
  }

  receive() external payable {
    // Default payable to accept ether payments for winning spirals
  }

  // Sometimes people send ETH to this contract - This is a way for the dev
  // to rescue ETH stuck here
  function rescueEth() external onlyOwner {
    (bool success, ) = owner().call{value: address(this).balance}("");
    require(success, "Transfer failed.");
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

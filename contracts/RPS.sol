// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./ImpishCrystal.sol";
import "./StakingV2.sol";
import "./SpiralBits.sol";

import "hardhat/console.sol";

contract RPS is IERC721Receiver, ReentrancyGuard, Ownable {
  enum Stages {
    Commit,
    Reveal,
    Resolve,
    Claim,
    Finished,
    Shutdown
  }
  Stages public stage;
  uint32 public lastRoundStartTime;

  //------------------
  // Stage transitions
  //-------------------
  modifier atStage(Stages _stage) {
    require(stage == _stage);
    _;
  }

  modifier timedTransitions() {
    if (stage == Stages.Commit && block.timestamp >= lastRoundStartTime + 3 days) {
      nextStage();
    }
    if (stage == Stages.Reveal && block.timestamp >= lastRoundStartTime + 6 days) {
      nextStage();
    }
    _;
  }

  function nextStage() internal {
    stage = Stages(uint256(stage) + 1);
  }

  ImpishCrystal public crystals;
  StakingV2 public stakingv2;

  //------------------
  // Teams
  //-------------------
  struct TeamInfo {
    uint96 totalScore;
    uint96 winningSpiralBits;
    uint8 symmetriesLost;
    uint32 numCrystals;
  }
  TeamInfo[3] teams;

  struct PlayerInfo {
    bytes32 commitment;
    bool revealed;
    uint8 team;
    uint32 allPlayersIndex;
    uint32[] crystalIDs;
  }

  //------------------
  // Players
  //-------------------
  // Data about all the bets made per address
  mapping(address => PlayerInfo) public players;
  // List of all addresses that are in the current round.
  address[] public allPlayers;

  struct SmallestTeamBonusInfo {
    uint96 bonusInSpiralBits;
    uint32 teamSize;
    uint32 totalCrystalsInSmallestTeams;
  }
  SmallestTeamBonusInfo public smallestTeamBonus;

  //------------------
  // Functions
  //-------------------
  constructor(address payable _stakingv2) {
    stakingv2 = StakingV2(_stakingv2);
    crystals = ImpishCrystal(stakingv2.crystals());

    // Allow staking to work for this address with Crystals
    crystals.setApprovalForAll(_stakingv2, true);

    lastRoundStartTime = uint32(block.timestamp);
    stage = Stages.Commit;
  }

  // Commit some Crystals to the game.
  function commit(
    bytes32 commitment,
    address player,
    uint32[] calldata crystalIDs
  ) external nonReentrant timedTransitions atStage(Stages.Commit) {
    require(crystalIDs.length > 0, "NeedAtLeastOne");
    require(players[player].crystalIDs.length == 0, "AlreadyPlaying");

    // Make sure the user owns or has staked the Crystal
    uint32[] memory contractTokenIDs = new uint32[](crystalIDs.length);
    for (uint256 i = 0; i < crystalIDs.length; i++) {
      uint32 tokenId = crystalIDs[i];
      require(crystals.ownerOf(tokenId) == msg.sender, "NotYourCrystal");
      (uint8 currentCrystalSize, , , , ) = crystals.crystals(tokenId);
      require(currentCrystalSize == 100, "NeedFullyGrownCrystal");

      // Transfer in all the Crystals and stake them.
      crystals.transferFrom(msg.sender, address(this), tokenId);
      contractTokenIDs[i] = 4_000_000 + tokenId;
    }

    // Stake all the Crystals, to start earning SPIRALBITS
    stakingv2.stakeNFTsForOwner(contractTokenIDs, address(this));

    players[player] = PlayerInfo(commitment, false, 0, uint32(allPlayers.length), crystalIDs);
    allPlayers.push(player);
  }

  // Reveal the commitment
  function revealCommitment(uint128 salt, uint8 team) external nonReentrant timedTransitions atStage(Stages.Reveal) {
    address player = msg.sender;
    // You can reveal commitments from day 3 to 6
    require(players[player].commitment == keccak256(abi.encodePacked(salt, team)), "BadCommitment");

    // Record all the info that was revealed
    players[player].team = team;
    players[player].revealed = true;

    // Do the team accounting.
    uint96 playerScore = 0;
    for (uint256 j = 0; j < players[player].crystalIDs.length; j++) {
      (, , , , uint192 spiralBitsStored) = crystals.crystals(players[player].crystalIDs[j]);
      playerScore += uint96(spiralBitsStored);

      // TODO: Add a gen bonus for Crystals
    }

    // Add the score to the team
    teams[team].totalScore += playerScore;
    teams[team].numCrystals += uint32(players[player].crystalIDs.length);
  }

  function _resolve() internal nonReentrant timedTransitions atStage(Stages.Resolve) {
    // Shatter and burn all unrevealed crystals.
    for (uint256 i = 0; i < allPlayers.length; i++) {
      address player = allPlayers[i];

      // Collect all ContractTokenIDs for this player so we can unstake them
      uint32[] memory contractTokenIDs = new uint32[](players[player].crystalIDs.length);
      for (uint256 j = 0; j < players[player].crystalIDs.length; j++) {
        uint32 tokenId = players[player].crystalIDs[j];
        contractTokenIDs[j] = 4_000_000 + tokenId;
      }

      // Unstake and collect the spiralbits
      stakingv2.unstakeNFTs(contractTokenIDs, true);

      if (!players[player].revealed) {
        // BAD! Player didn't reveal their commitment, fine them
        for (uint256 j = 0; j < players[player].crystalIDs.length; j++) {
          uint32 tokenId = players[player].crystalIDs[j];
          crystals.shatter(tokenId);
        }
      }
    }

    // Each team attacks the next team and defends from the previous team
    uint32 smallestTeamSize = 2**32 - 1;
    for (uint256 i = 0; i < 3; i++) {
      if (teams[i].numCrystals < smallestTeamSize) {
        smallestTeamSize = teams[i].numCrystals;
      }

      uint256 nextTeam = (i + 1) % 3;
      if (teams[i].totalScore > teams[nextTeam].totalScore) {
        // 100 size * 1 symmetry * 1000 SPIRALBITS per size per sym * num of crystals involved
        uint96 winnings = 100 * 1 * 1000 * uint96(teams[nextTeam].numCrystals);

        teams[i].winningSpiralBits = winnings;
        teams[nextTeam].symmetriesLost = 1;
      } else {
        // Successfully defended, so nothing happens.
      }
    }

    // Find all the teams that have the smallest team size
    uint32 totalCrystalsInSmallestTeams = 0;
    for (uint256 i = 0; i < 3; i++) {
      if (teams[i].numCrystals == smallestTeamSize) {
        totalCrystalsInSmallestTeams += teams[i].numCrystals;
      }
    }

    // Record all the spiralbits we have for the smallest team bonus
    smallestTeamBonus = SmallestTeamBonusInfo(
      uint96(SpiralBits(stakingv2.spiralbits()).balanceOf(address(this))),
      smallestTeamSize,
      totalCrystalsInSmallestTeams
    );

    // Burn the bonuses so we can mint it for the individual users again
    SpiralBits(stakingv2.spiralbits()).burn(smallestTeamBonus.bonusInSpiralBits);

    // Set the stage to claim, so everyone can claim their winnings and crystals
    stage = Stages.Claim;
  }

  // After all commitments are revealed, we need to resolve it
  function resolve() external {
    _resolve();
  }

  // Claim for msg.sender directly to save on gas
  function claim() external {
    claimForOwner(msg.sender);
  }

  // Claim the winnings or losses for a player. This can be called for anyone by anyone,
  // so that we can return the winnings to a user even if they don't claim in time.
  function claimForOwner(address player) public {
    require(players[player].revealed, "NotRevealed");

    if (stage == Stages.Reveal) {
      // Attempt to resolve first
      _resolve();
    }

    _claimForOwner(player);
  }

  // Claim for owner internal function
  function _claimForOwner(address player) internal nonReentrant atStage(Stages.Claim) {
    uint8 team = players[player].team;

    if (teams[team].numCrystals > 0) {
      uint96 myWinnings = (teams[team].winningSpiralBits * uint96(players[player].crystalIDs.length)) /
        uint96(teams[team].numCrystals);

      // See if we got a small team bonus
      if (teams[team].numCrystals == smallestTeamBonus.teamSize && smallestTeamBonus.totalCrystalsInSmallestTeams > 0) {
        myWinnings +=
          (smallestTeamBonus.bonusInSpiralBits * uint96(players[player].crystalIDs.length)) /
          smallestTeamBonus.totalCrystalsInSmallestTeams;
      }

      // See if we lost, and if we did, remove a symmetry for each crystal
      if (teams[team].symmetriesLost > 0) {
        // It costs 20k SPIRALBITS to remove symmetries, so mint it. This will be burned
        SpiralBits(stakingv2.spiralbits()).mintSpiralBits(
          address(this),
          20000 ether * players[player].crystalIDs.length
        );
        for (uint256 j = 0; j < players[player].crystalIDs.length; j++) {
          uint256 tokenId = players[player].crystalIDs[j];
          crystals.decSym(uint32(tokenId), 1);
        }
      }

      // Generate winnings for the user. Note that this includes the smallest team bonus,
      // which was previously burned, so we just mint it again. Saves on approvals.
      if (myWinnings > 0) {
        SpiralBits(stakingv2.spiralbits()).mintSpiralBits(player, myWinnings);
      }

      // And transfer the crystals back to the user
      for (uint256 j = 0; j < players[player].crystalIDs.length; j++) {
        uint256 tokenId = players[player].crystalIDs[j];
        crystals.safeTransferFrom(address(this), player, tokenId);
      }

      // Delete player from the structure
      uint256 index = players[player].allPlayersIndex;
      // Swap with the last element
      allPlayers[index] = allPlayers[allPlayers.length - 1];
      allPlayers.pop();
      delete players[player];

      // If all players have been claimed, then advance the stage
      if (allPlayers.length == 0) {
        stage = Stages.Finished;
      }
    }
  }


  // After a round is finished, reset for next round.
  function resetForNextRound(bool shutdown) external {
    // If not finished, then claim on behalf of all remaining people
    if (stage == Stages.Claim) {
      for (uint256 i = allPlayers.length - 1; i >= 0; i--) {
        claimForOwner(allPlayers[i]);
      }
    }

    require(stage == Stages.Finished, "CouldntClaimForEveryone");
    require(allPlayers.length == 0, "Safety assert1");

    if (shutdown) {
      stage = Stages.Shutdown;
    } else {
      // Reset all the team info
      for (uint256 i = 0; i < 3; i++) {
        teams[i] = TeamInfo(0, 0, 0, 0);
      }
      smallestTeamBonus = SmallestTeamBonusInfo(0, 0, 0);
      stage = Stages.Commit;
      lastRoundStartTime = uint32(block.timestamp);
    }
  }

  // function generateCommitment(uint128 salt, uint8 team) public pure returns (bytes32) {
  //     return keccak256(abi.encodePacked(salt, team));
  // }

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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./ImpishCrystal.sol";
import "./StakingV2.sol";

import "hardhat/console.sol";

contract RPS is IERC721Receiver, ReentrancyGuard, Ownable {

    enum ContractStatus {
        Commit,
        Reveal,
        Resolve,
        Claim,
        Finished
    }
    ContractStatus public status;

    ImpishCrystal public crystals;
    StakingV2 public stakingv2;

    struct TeamInfo {
        bytes32 commitment;
        uint8 team;
        uint96 spiralBitsWinnings;
        uint8 symmetriesLost;
        uint32[] crystalIDs;
    }

    mapping(address => TeamInfo) public players;

    constructor(address payable _stakingv2) {
        stakingv2 = StakingV2(_stakingv2);
        crystals = ImpishCrystal(stakingv2.crystals());

        status = ContractStatus.Commit;
    }

    // Commit some Crystals to the game. 
    function commit(bytes32 commitment, address owner, uint32[] calldata crystalIDs) external {
        require(status == ContractStatus.Commit, "NotCommitPhase");

        // Make sure the user owns or has staked the Crystal
        uint32[] memory contractTokenIDs = new uint32[](crystalIDs.length);
        for (uint256 i = 0; i < crystalIDs.length; i++) {
            uint32 tokenId = crystalIDs[i];
            require(crystals.ownerOf(tokenId) == msg.sender, "NotYourCrystal");
            (uint8 currentCrystalSize, , , , ) = crystals.crystals(tokenId);
            require(currentCrystalSize == 100, "NeedFullyGrownCrystal");

            // Transfer in all the Crystals and stake them. 
            crystals.transferFrom(msg.sender, address(this),tokenId);
            contractTokenIDs[i] = 3000000 + tokenId;
        }

        // Stake all the Crystals, to start earning SPIRALBITS
        stakingv2.stakeNFTsForOwner(contractTokenIDs, address(this));
        
        players[owner] = TeamInfo(commitment, 0, 0, 0, crystalIDs);
    }

    function revealCommitment(uint128 salt, uint8 team) external {
        // require(status == ContractStatus.Reveal, "NotRevealPhase");
        require(players[msg.sender].commitment == keccak256(abi.encodePacked(salt, team)), "BadCommitment");

        // Record all the info that was revealed
        players[msg.sender].team = team;
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
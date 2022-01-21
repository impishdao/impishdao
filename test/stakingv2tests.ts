/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { StakingV2 } from "../typechain/StakingV2";

import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  stakingv2: StakingV2;
};

describe.only("SpiralStaking V2", function () {
  async function loadContracts(): Promise<FixtureType> {
    const ImpishDAO = await ethers.getContractFactory("ImpishDAO");
    const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");

    const rwnft = await RandomWalkNFT.deploy();
    await rwnft.deployed();

    const impdao = await ImpishDAO.deploy(rwnft.address);
    await impdao.deployed();

    const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");
    const impishSpiral = await ImpishSpiral.deploy(rwnft.address, impdao.address);
    await impishSpiral.deployed();

    const SpiralBits = await ethers.getContractFactory("SpiralBits");
    const spiralbits = await SpiralBits.deploy();
    await spiralbits.deployed();

    const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
    const spiralstaking = await SpiralStaking.deploy(impishSpiral.address, spiralbits.address, rwnft.address);
    await spiralstaking.deployed();

    const ImpishCrystal = await ethers.getContractFactory("ImpishCrystal");
    const crystal = await ImpishCrystal.deploy(impishSpiral.address, spiralstaking.address, spiralbits.address);
    await crystal.deployed();

    const StakingV2 = await ethers.getContractFactory("StakingV2");
    const stakingv2 = await StakingV2.deploy(crystal.address);
    await stakingv2.deployed();

    // Allow spiral staking to mint spiralbits
    spiralbits.addAllowedMinter(stakingv2.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, stakingv2 };
  }

  it("Simple Staking V2", async function () {
    const { impishSpiral, impdao, spiralbits, stakingv2 } = await loadContracts();
    const [signer] = await ethers.getSigners();

    const Eth100 = ethers.utils.parseEther("100");

    // Approve spiralbits
    await spiralbits.approve(stakingv2.address, ethers.utils.parseEther("1000000"));
    await stakingv2.stakeSpiralBits(Eth100);

    await expect(() => stakingv2.unstakeSpiralBits(false)).to.changeTokenBalance(spiralbits, signer, Eth100);

    // Approve IMPISH
    await impdao.approve(stakingv2.address, ethers.utils.parseEther("1000000"));
    await impdao.deposit({ value: Eth100 });
    await stakingv2.stakeImpish(Eth100);

    await expect(() => stakingv2.unstakeImpish(false)).to.changeTokenBalance(impdao, signer, Eth100);
  });

  it("Staking - Win while staked", async function () {
    const { impishSpiral, stakingv2 } = await loadContracts();
    const [signer] = await ethers.getSigners();

    // Approve staking
    await impishSpiral.setApprovalForAll(stakingv2.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake
    await stakingv2.stakeNFTsForOwner([tokenId.add(2000000)], signer.address);

    // Now, fast forward 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 4]); // 4 days
    await network.provider.send("evm_mine");

    // We can claim it via the Staking contract
    await expect(await stakingv2.claimSpiralWin(tokenId)).to.changeEtherBalance(
      signer,
      ethers.utils.parseEther("0.00005025") // Only 1 winner, so this is the prize
    );

    // And then afterall winnings should work
    await impishSpiral.afterAllWinnings();
  });
});

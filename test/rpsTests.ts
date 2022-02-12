/* eslint-disable no-unused-vars */
/* eslint-disable node/no-missing-import */

import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { ImpishCrystal } from "../typechain/ImpishCrystal";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { StakingV2 } from "../typechain/StakingV2";
import type { RPS } from "../typechain/RPS";

import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { expect } from "chai";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  stakingv2: StakingV2;
  spiralbits: SpiralBits;
  crystal: ImpishCrystal;
  rps: RPS;
};

describe("RPS", function () {
  const Zero = BigNumber.from(0);
  const Eth2B = ethers.utils.parseEther("2000000000");
  const Eth100 = ethers.utils.parseEther("100");
  const Eth10 = ethers.utils.parseEther("10");

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
    const stakingv2 = await StakingV2.deploy();
    await stakingv2.deployed();
    await stakingv2.initialize(crystal.address);

    // Allow spiral staking to mint spiralbits
    await spiralbits.addAllowedMinter(stakingv2.address);

    // Start the mints
    await impishSpiral.startMints();

    const RPS = await ethers.getContractFactory("RPS");
    const rps = await RPS.deploy(stakingv2.address);
    await rps.deployed();

    // Allow RPS to mint
    await spiralbits.addAllowedMinter(rps.address);

    return { impishSpiral, spiralbits, crystal, stakingv2, rps };
  }

  it("Commits And Verify Simple", async function () {
    const { impishSpiral, stakingv2, spiralbits, crystal, rps } = await loadContracts();
    const [signer] = await ethers.getSigners();

    // Mint a spiral and then a crystal
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    const crystalTokenId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([spiralTokenId], 0);

    await spiralbits.approve(crystal.address, Eth2B);
    await crystal.grow(crystalTokenId, 70);

    await crystal.setApprovalForAll(rps.address, true);

    const password = "password";
    const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));
    const commitment = ethers.utils.solidityKeccak256(["uint256", "uint8"], [salt, 1]);
    await rps.commit(commitment, signer.address, [crystalTokenId]);

    expect(await crystal.ownerOf(crystalTokenId)).to.be.equals(stakingv2.address);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    await rps.revealCommitment(salt, 1);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Directly claim, which should also resolve
    await rps.claim();

    // Make sure the Crystal came back to us.
    expect(await crystal.ownerOf(crystalTokenId)).to.be.equals(signer.address);
  });

  it("Negative Tests", async function () {
    const { impishSpiral, spiralbits, crystal, rps } = await loadContracts();
    const [signer] = await ethers.getSigners();

    // Mint a spiral and then a crystal
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    const crystalTokenId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([spiralTokenId], 0);

    await spiralbits.approve(crystal.address, Eth2B);

    await crystal.setApprovalForAll(rps.address, true);

    const password = "password";
    const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));
    const commitment = ethers.utils.solidityKeccak256(["uint256", "uint8"], [salt, 1]);

    // Need at least one crystal
    await expect(rps.commit(commitment, signer.address, [])).to.be.revertedWith("NeedAtLeastOne");

    await expect(rps.commit(commitment, signer.address, [crystalTokenId])).to.be.revertedWith("NeedFullyGrownCrystal");
    await crystal.grow(crystalTokenId, 70);

    // This will work
    await rps.commit(commitment, signer.address, [crystalTokenId]);

    // Can't commit again
    await expect(rps.commit(commitment, signer.address, [crystalTokenId])).to.be.revertedWith("AlreadyPlaying");

    // Can't reveal yet
    await expect(rps.revealCommitment(salt, 1)).to.be.revertedWith("WrongStage");

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Attempt to resolve, even though it is not time yet
    await expect(rps.resolve()).to.be.revertedWith("WrongStage");

    // Attempt to claim, even though it is not yet time
    await expect(rps.claim()).to.be.revertedWith("NotRevealed");

    // Can't reveal wrong commitment - wrong team or wrong salt
    await expect(rps.revealCommitment(salt, 0)).to.be.revertedWith("BadCommitment");
    await expect(rps.revealCommitment(salt.add(1), 1)).to.be.revertedWith("BadCommitment");

    // This will work
    await rps.revealCommitment(salt, 1);

    // Cannot resolve even though everyone has revealed, because 3 days have not passed.
    await expect(rps.claim()).to.be.revertedWith("WrongStage");

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Now this will work
    await rps.resolve();
    await rps.claim();
  });

  it("Resolve without reveal", async function () {
    const { impishSpiral, spiralbits, crystal, rps } = await loadContracts();
    const [signer] = await ethers.getSigners();

    await spiralbits.approve(crystal.address, Eth2B);

    // Mint a spiral and then a crystal
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    const crystalTokenId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([spiralTokenId], 0);
    await crystal.grow(crystalTokenId, 70);

    const beforeSym = (await crystal.crystals(crystalTokenId)).sym;

    await crystal.setApprovalForAll(rps.address, true);

    const password = "password";
    const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));
    const commitment = ethers.utils.solidityKeccak256(["uint256", "uint8"], [salt, 1]);
    await rps.commit(commitment, signer.address, [crystalTokenId]);

    // Advance 6 days without revealing
    await network.provider.send("evm_increaseTime", [3600 * 24 * 6]);
    await network.provider.send("evm_mine");

    // Can't reveal now, since time has already passed
    await expect(rps.revealCommitment(salt, 1)).to.be.revertedWith("WrongStage");

    // ... but can resolve
    await rps.resolve();

    // This should return our crystal, but with 2 reduced symmetries
    const afterSym = (await crystal.crystals(crystalTokenId)).sym;
    expect(await crystal.ownerOf(crystalTokenId)).to.be.equals(signer.address);
    expect(beforeSym - afterSym).to.be.equals(2);
  });
});

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
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  stakingv2: StakingV2;
  spiralbits: SpiralBits;
  crystal: ImpishCrystal;
  rps: RPS;
};

const zip = (a: Array<any>, b: Array<any>) => a.map((k, i) => [k, b[i]]);

describe("RPS", function () {
  const Zero = BigNumber.from(0);
  const Eth2B = ethers.utils.parseEther("2000000000");
  const Eth1M = ethers.utils.parseEther("1000000");
  const Eth1k = ethers.utils.parseEther("1000");
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

  it("Multi user test", async function () {
    const { impishSpiral, spiralbits, crystal, rps } = await loadContracts();
    const [signer1, signer2, signer3] = await ethers.getSigners();

    await spiralbits.connect(signer1).approve(crystal.address, Eth2B);
    await spiralbits.connect(signer2).approve(crystal.address, Eth2B);
    await spiralbits.connect(signer3).approve(crystal.address, Eth2B);
    await crystal.connect(signer1).setApprovalForAll(rps.address, true);
    await crystal.connect(signer2).setApprovalForAll(rps.address, true);
    await crystal.connect(signer3).setApprovalForAll(rps.address, true);

    // First user stakes 1 Crystal
    const mintCrystals = async (count: number, address: string): Promise<BigNumber[]> => {
      const mintedCrystals = [];

      for (let i = 0; i < count; i++) {
        const spiralId = await impishSpiral._tokenIdCounter();
        await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

        const crystalId = await crystal._tokenIdCounter();
        await crystal.mintCrystals([spiralId], 0);
        mintedCrystals.push(BigNumber.from(crystalId));

        // Max out the crystal
        await crystal.grow(crystalId, 70);

        if (address !== signer1.address) {
          await crystal["safeTransferFrom(address,address,uint256)"](signer1.address, address, crystalId);
          await spiralbits.transfer( address, Eth1M);
        }
      }

      return mintedCrystals;
    };

    const rpsCommit = async (
      signer: SignerWithAddress,
      password: string,
      team: number,
      address: string,
      crystals: BigNumber[]
    ) => {
      const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));
      const commitment = ethers.utils.solidityKeccak256(["uint256", "uint8"], [salt, team]);
      await rps.connect(signer).commit(commitment, address, crystals);
    };

    const rpsReveal = async (signer: SignerWithAddress, password: string, team: number) => {
      const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)));
      await rps.connect(signer).revealCommitment(salt, team);
    };

    let signer1Crystals = await mintCrystals(1, signer1.address);
    let signer1SymsBefore = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer1, "1", 0, signer1.address, signer1Crystals);

    let signer2Crystals = await mintCrystals(2, signer2.address);
    let signer2SymsBefore = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer2, "2", 1, signer2.address, signer2Crystals);

    let signer3Crystals = await mintCrystals(3, signer3.address);
    let signer3SymsBefore = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer3, "3", 2, signer3.address, signer3Crystals);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Reveal all 3 commitments
    await rpsReveal(signer1, "1", 0);
    await rpsReveal(signer2, "2", 1);
    await rpsReveal(signer3, "3", 2);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    await rps.resolve();

    // Signer1 has got the smallest team bonus
    let signer1beforeSpiralBits = await spiralbits.balanceOf(signer1.address);
    await rps.connect(signer1).claim();
    let signer1afterSpiralBits = await spiralbits.balanceOf(signer1.address);
    expect(signer1afterSpiralBits.sub(signer1beforeSpiralBits)).to.be.gt(Eth1M);

    signer1Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer1.address));
    let signer1SymsAfter = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    // Only team 1 has lost sym
    zip(signer1SymsBefore, signer1SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a + 1));

    // Signer2 has not lost anything and not won anything
    let signer2beforeSpiralBits = await spiralbits.balanceOf(signer2.address);
    await rps.connect(signer2).claim();
    let signer2afterSpiralBits = await spiralbits.balanceOf(signer2.address);
    expect(signer2afterSpiralBits).to.be.equal(signer2beforeSpiralBits);

    signer2Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer2.address));
    let signer2SymsAfter = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer2SymsBefore, signer2SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));

    // Signer3 has won a small amount of SpiralBits from the first team
    let signer3beforeSpiralBits = await spiralbits.balanceOf(signer3.address);
    await rps.connect(signer3).claim();
    let signer3afterSpiralBits = await spiralbits.balanceOf(signer3.address);
    expect(signer3afterSpiralBits.sub(signer3beforeSpiralBits)).to.be.equal(Eth1k.mul(100));

    signer3Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer3.address));
    let signer3SymsAfter = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer3SymsBefore, signer3SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));

    // After it's done, reset for next round
    await rps.resetForNextRound(false);

    const requireAtLeast5Sym = async (crystalIds: BigNumber[], signer: SignerWithAddress) => {
      for (let i = 0; i < crystalIds.length; i++) {
        if ((await crystal.crystals(crystalIds[i])).sym < 5) {
          await crystal.connect(signer).addSym(crystalIds[i], 2);
          await crystal.connect(signer).grow(crystalIds[i], 100 - (await crystal.crystals(crystalIds[i])).size);
        }
        // console.log((await crystal.crystals(crystalIds[i])).sym, "-", (await crystal.crystals(crystalIds[i])).size );
      }
    };

    // -----
    // Round 2: This time, not everyone reveals
    await requireAtLeast5Sym(signer1Crystals, signer1);
    signer1SymsBefore = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer1, "1", 0, signer1.address, signer1Crystals);

    await requireAtLeast5Sym(signer2Crystals, signer2);
    signer2SymsBefore = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer2, "2", 1, signer2.address, signer2Crystals);

    await requireAtLeast5Sym(signer3Crystals, signer3);
    signer3SymsBefore = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer3, "3", 2, signer3.address, signer3Crystals);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Only signer 1 and 2 reveal, signer3 does not reveal.
    await rpsReveal(signer1, "1", 0);
    await rpsReveal(signer2, "2", 1);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Signer1 did not get the smallest team bonus, since the smallest team is technically 3, since
    // signer3 didn't reveal. signer1 also didn't win or lose anything
    signer1beforeSpiralBits = await spiralbits.balanceOf(signer1.address);
    await rps.connect(signer1).claim();
    signer1afterSpiralBits = await spiralbits.balanceOf(signer1.address);
    expect(signer1afterSpiralBits).to.be.equal(signer1afterSpiralBits);

    signer1Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer1.address));
    signer1SymsAfter = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    // nothing lost
    zip(signer1SymsBefore, signer1SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));

    // Can't claim again
    await expect(rps.connect(signer1).claim()).to.be.revertedWith("AlreadyClaimed");

    // Signer2 has not lost anything and not won anything. Technically he won against team 3, but
    // since team 3 has 0 crystals, the winning spiralbits are 0.
    signer2beforeSpiralBits = await spiralbits.balanceOf(signer2.address);
    await rps.connect(signer2).claim();
    signer2afterSpiralBits = await spiralbits.balanceOf(signer2.address);
    expect(signer2afterSpiralBits).to.be.equal(signer2beforeSpiralBits);

    signer2Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer2.address));
    signer2SymsAfter = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer2SymsBefore, signer2SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));

    // Can't claim again
    await expect(rps.connect(signer2).claim()).to.be.revertedWith("AlreadyClaimed");

    // Claiming for signer3 is an error, because he never revealed. Nowever, he got the crystals back with -2 sym.
    await expect(rps.connect(signer3).claim()).to.be.revertedWith("NotRevealed");
    signer3Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer3.address));
    signer3SymsAfter = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer3SymsBefore, signer3SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a + 2));

    // After it's done, reset for next round
    await rps.resetForNextRound(false);

    //------
    // Round3 , reveal but don't claim.
    await requireAtLeast5Sym(signer1Crystals, signer1);
    signer1SymsBefore = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer1, "1", 0, signer1.address, signer1Crystals);

    await requireAtLeast5Sym(signer2Crystals, signer2);
    signer2SymsBefore = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer2, "2", 1, signer2.address, signer2Crystals);

    await requireAtLeast5Sym(signer3Crystals, signer3);
    signer3SymsBefore = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    await rpsCommit(signer3, "3", 2, signer3.address, signer3Crystals);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Only signer 1 and 2 reveal, signer3 does not reveal.
    await rpsReveal(signer1, "1", 0);
    await rpsReveal(signer2, "2", 1);
    await rpsReveal(signer3, "3", 2);

    // Advance 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
    await network.provider.send("evm_mine");

    // Signer1 has got the smallest team bonus
    signer1beforeSpiralBits = await spiralbits.balanceOf(signer1.address);
    await rps.connect(signer1).claim();
    signer1afterSpiralBits = await spiralbits.balanceOf(signer1.address);
    expect(signer1afterSpiralBits.sub(signer1beforeSpiralBits)).to.be.gt(Eth1M);

    signer1Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer1.address));
    signer1SymsAfter = await Promise.all(signer1Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    // Only team 1 has lost sym
    zip(signer1SymsBefore, signer1SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a + 1));

    // Signer2 has not lost anything and not won anything
    signer2beforeSpiralBits = await spiralbits.balanceOf(signer2.address);
    await rps.connect(signer2).claim();
    signer2afterSpiralBits = await spiralbits.balanceOf(signer2.address);
    expect(signer2afterSpiralBits).to.be.equal(signer2beforeSpiralBits);

    signer2Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer2.address));
    signer2SymsAfter = await Promise.all(signer2Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer2SymsBefore, signer2SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));

    signer3beforeSpiralBits = await spiralbits.balanceOf(signer3.address);
    // Reset for next round, but since signer3 hasn't claimed, it should implicitly claim
    await rps.resetForNextRound(false);
    signer3afterSpiralBits = await spiralbits.balanceOf(signer3.address);
    expect(signer3afterSpiralBits.sub(signer3beforeSpiralBits)).to.be.equal(Eth1k.mul(100));

    signer3Crystals.forEach(async (cid) => expect(await crystal.ownerOf(cid)).to.be.equals(signer3.address));
    signer3SymsAfter = await Promise.all(signer3Crystals.map(async (cid) => (await crystal.crystals(cid)).sym));
    zip(signer3SymsBefore, signer3SymsAfter).forEach(([b, a]) => expect(b).to.be.equal(a));
  });
});

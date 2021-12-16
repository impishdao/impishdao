/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
};

describe("ImpishSpiral", function () {
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

    return { impishSpiral, impdao, rwnft };
  }

  it("Should not work until started", async function () {
    const { impishSpiral, impdao, rwnft } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    expect(await impishSpiral.started()).to.equal(false);

    // First mint is 0.005 ETH + 0.5%
    expect(await impishSpiral.getMintPrice()).to.equal(ethers.utils.parseEther("0.005025"));

    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await expect(impishSpiral.mintSpiralWithRWNFT(0)).to.be.revertedWith("NotYetStarted");
    await expect(impishSpiral.claimWin(1)).to.be.revertedWith("NotYetStarted");
    await expect(impishSpiral.mintSpiralRandom()).to.be.revertedWith("NotYetStarted");

    // Start the mints
    await impishSpiral.startMints();

    // Mint random
    await impishSpiral.mintSpiralRandom({ value: impishSpiral.getMintPrice() });

    // Assert balances
    expect(await impdao.balanceOf(impishSpiral.address), "spiral balance").to.be.equal(0);
    expect(await impdao.balanceOf(wallet.address), "wallet balance").to.be.equal(0);

    // Mint with RW, since we own #0
    const mintPrice = await impishSpiral.getMintPrice();
    const tokenId = await impishSpiral.totalSupply(); // This will be the minted Spiral ID
    await impishSpiral.mintSpiralWithRWNFT(0, { value: mintPrice });

    expect(await impdao.balanceOf(impishSpiral.address), "spiral balance").to.be.equal(0);
    expect(await impdao.balanceOf(wallet.address)).to.be.equal(mintPrice.mul(33).div(100).mul(1000));

    // Make sure we have the minted spiral, and it has the same seed as our RandomWalkNFT #0
    expect(await impishSpiral.ownerOf(tokenId)).to.be.equal(wallet.address);
    expect(await impishSpiral.spiralSeeds(tokenId)).to.be.equal(await rwnft.seeds(0));

    // Try minting with the same RandomWalkNFT again, will fail
    await expect(impishSpiral.mintSpiralWithRWNFT(0)).to.be.revertedWith("AlreadyMinted");
  });

  it("Should allow winnings (10) by single wallet", async function () {
    const { impishSpiral } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Start the mints
    await impishSpiral.startMints();

    // Mint 10 random NFTs
    for (let i = 0; i < 10; i++) {
      await impishSpiral.mintSpiralRandom({
        value: await impishSpiral.getMintPrice(),
      });
      expect(await impishSpiral.ownerOf(i)).to.be.equal(wallet.address);
    }

    // Prematurely claiming win is error
    await expect(impishSpiral.claimWin(0)).to.be.revertedWith("MintsStillOpen");

    // After 10 mints, advance EVM time by 3 days to win it.
    await network.provider.send("evm_increaseTime", [1 + 3600 * 24 * 3]); // 3 days + 1 sec
    await network.provider.send("evm_mine");

    const totalReward = await impishSpiral.totalReward();

    // Now, claim the winnings
    let rewardsClaimed = BigNumber.from(0);
    for (let i = 0; i < 10; i++) {
      const expectedReward = totalReward.mul(i + 1).div(100);
      rewardsClaimed = rewardsClaimed.add(expectedReward);

      await expect(await impishSpiral.claimWin(i), `Didn't get Reward for ${i}`).to.changeEtherBalance(
        wallet,
        expectedReward
      );

      expect(await impishSpiral.winningsClaimed(i)).to.be.equal(true);
      // Claiming it again should be error
      await expect(impishSpiral.claimWin(i)).to.be.revertedWith("AlreadyClaimed");
    }

    // Now claim the developer fee
    const actualDevFee = totalReward.sub(rewardsClaimed);
    await expect(await impishSpiral.afterAllWinnings()).to.changeEtherBalance(wallet, actualDevFee);
    expect(actualDevFee.sub(totalReward.mul(45).div(100)).toNumber()).to.be.closeTo(0, 10);

    // Now should be empty
    await expect(impishSpiral.afterAllWinnings()).to.be.revertedWith("Empty");
  });

  it("Should allow winnings (10 RWNFTs) by single wallet", async function () {
    const { impishSpiral, rwnft, impdao } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Start the mints
    await impishSpiral.startMints();

    // Mint 10 random NFTs
    for (let i = 0; i < 10; i++) {
      // Mint a RWNFT
      const rwnftTokenId = await rwnft.nextTokenId();
      await rwnft.mint({ value: await rwnft.getMintPrice() });

      const mintPrice = await impishSpiral.getMintPrice();

      await expect(() => impishSpiral.mintSpiralWithRWNFT(rwnftTokenId, { value: mintPrice })).to.changeTokenBalance(
        impdao, // Should change IMPISH token balance by
        wallet,
        mintPrice.mul(33).div(100).mul(1000) // 33% of mint price
      );
      expect(await impishSpiral.ownerOf(i)).to.be.equal(wallet.address);
    }

    // Prematurely claiming win is error
    await expect(impishSpiral.claimWin(0)).to.be.revertedWith("MintsStillOpen");

    // After 10 mints, advance EVM time by 3 days to win it.
    await network.provider.send("evm_increaseTime", [1 + 3600 * 24 * 3]); // 3 days + 1 sec
    await network.provider.send("evm_mine");

    // Can't claim win for bogus token
    await expect(impishSpiral.claimWin(100)).to.be.revertedWith("TokenIDOutofRange");

    const totalReward = await impishSpiral.totalReward();

    // Now, claim the winnings
    let rewardsClaimed = BigNumber.from(0);
    for (let i = 0; i < 10; i++) {
      const expectedReward = totalReward.mul(i + 1).div(100);
      rewardsClaimed = rewardsClaimed.add(expectedReward);

      await expect(await impishSpiral.claimWin(i), `Didn't get Reward for ${i}`).to.changeEtherBalance(
        wallet,
        expectedReward
      );

      expect(await impishSpiral.winningsClaimed(i)).to.be.equal(true);
      // Claiming it again should be error
      await expect(impishSpiral.claimWin(i)).to.be.revertedWith("AlreadyClaimed");
    }

    // Now claim the developer fee
    const actualDevFee = await provider.getBalance(impishSpiral.address);
    await expect(await impishSpiral.afterAllWinnings()).to.changeEtherBalance(wallet, actualDevFee);

    // The actual dev fee should be 12% of total reward
    expect(actualDevFee.sub(totalReward.mul(12).div(100)).toNumber()).to.be.closeTo(0, 10);

    // Now should be empty
    await expect(impishSpiral.afterAllWinnings()).to.be.revertedWith("Empty");
  });

  it("Should allow setting of Spiral Lengths", async function () {
    const { impishSpiral, rwnft } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a Spiral
    await impishSpiral.mintSpiralRandom({
      value: await impishSpiral.getMintPrice(),
    });

    // Setting the spiralBitsContract/spiralLengths from a non-owner should fail
    await expect(impishSpiral.connect(otherSigner).setSpiralBitsContract(rwnft.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(impishSpiral.connect(otherSigner).setSpiralLengths([], [])).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Spiral length should be settable only by the owner
    expect(await impishSpiral.spiralLengths(0)).to.be.equals(0);
    await impishSpiral.setSpiralLengths([0], [1000000]);
    expect(await impishSpiral.spiralLengths(0)).to.be.equals(1000000);

    // Set the wallet as the calling contract
    await impishSpiral.setSpiralBitsContract(signer.address);

    // Now we can add and remove spiral bits
    await impishSpiral.removeLengthFromSpiral(0, 1000);
    expect(await impishSpiral.spiralLengths(0)).to.be.equals(1000000 - 1000);

    await impishSpiral.addLengthToSpiral(0, 5000);
    expect(await impishSpiral.spiralLengths(0)).to.be.equals(1000000 - 1000 + 5000);

    // Can't remove or add too much
    await expect(impishSpiral.removeLengthFromSpiral(0, 700000)).to.be.revertedWith("CantTrimAnyMore");
    await expect(impishSpiral.addLengthToSpiral(0, 5000000)).to.be.revertedWith("CantAddAnyMore");
  });
});

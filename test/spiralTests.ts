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
    const firstMintPrice = await impishSpiral.getMintPrice();
    expect(await impishSpiral.getMintPrice()).to.equal(ethers.utils.parseEther("0.005025"));

    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await expect(impishSpiral.mintSpiralWithRWNFT(0, { value: firstMintPrice })).to.be.revertedWith("NotStarted");
    await expect(impishSpiral.claimWin(1)).to.be.revertedWith("NotStarted");
    await expect(impishSpiral.mintSpiralRandom({ value: firstMintPrice })).to.be.revertedWith("NotStarted");

    // Start the mints
    await impishSpiral.startMints();

    // Mint random
    await impishSpiral.mintSpiralRandom({ value: firstMintPrice });

    // Assert balances
    expect(await impdao.balanceOf(impishSpiral.address), "spiral balance").to.be.equal(0);
    expect(await impdao.balanceOf(wallet.address), "wallet balance").to.be.equal(0);

    // Can't mint with less than mint price
    await expect(impishSpiral.mintSpiralRandom({ value: 1 })).to.be.revertedWith("NotEnoughETH");

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
    await expect(impishSpiral.mintSpiralWithRWNFT(0)).to.be.revertedWith("Minted");
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
    await expect(impishSpiral.claimWin(0)).to.be.revertedWith("StillOpen");

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
      await expect(impishSpiral.claimWin(i)).to.be.revertedWith("Claimed");
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

    // Can't mint a second RWNFT companion
    // 2 because the ImpishSpiral has the rwnft-1 (to issue IMPISH tokens)
    const lastRwNFTTokenId = (await rwnft.nextTokenId()).sub(2);
    await expect(
      impishSpiral.mintSpiralWithRWNFT(lastRwNFTTokenId, { value: await impishSpiral.getMintPrice() })
    ).to.be.revertedWith("Minted");

    // Can't mint one that we don't own.
    // This one is owned by IMPISH DAO, generated when issuing IMPISH tokens
    const notWalletRwNFTTokenId = (await rwnft.nextTokenId()).sub(1);
    await expect(
      impishSpiral.mintSpiralWithRWNFT(notWalletRwNFTTokenId, { value: await impishSpiral.getMintPrice() })
    ).to.be.revertedWith("DoesntOwnToken");

    // Can't mint non-existing token
    // This one is owned by IMPISH DAO, generated when issuing IMPISH tokens
    const notExistingRwNFTTokenId = await rwnft.nextTokenId();
    await expect(
      impishSpiral.mintSpiralWithRWNFT(notExistingRwNFTTokenId, { value: await impishSpiral.getMintPrice() })
    ).to.be.revertedWith("ERC721: owner query for nonexistent token");

    // Prematurely claiming win is error
    await expect(impishSpiral.claimWin(0)).to.be.revertedWith("StillOpen");

    // After 10 mints, advance EVM time by 3 days to win it.
    await network.provider.send("evm_increaseTime", [1 + 3600 * 24 * 3]); // 3 days + 1 sec
    await network.provider.send("evm_mine");

    // Can't mint tokens after
    await expect(impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() })).to.be.revertedWith(
      "MintsFinished"
    );

    // Can't claim win for bogus token
    await expect(impishSpiral.claimWin(100)).to.be.revertedWith("OutofRange");

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
      await expect(impishSpiral.claimWin(i)).to.be.revertedWith("Claimed");
    }

    // Now claim the developer fee
    const actualDevFee = await provider.getBalance(impishSpiral.address);
    await expect(await impishSpiral.afterAllWinnings()).to.changeEtherBalance(wallet, actualDevFee);

    // The actual dev fee should be 12% of total reward
    expect(actualDevFee.sub(totalReward.mul(12).div(100)).toNumber()).to.be.closeTo(0, 10);

    // Now should be empty
    await expect(impishSpiral.afterAllWinnings()).to.be.revertedWith("Empty");
  });

  it("Should return excess ETH", async function () {
    const { impishSpiral, rwnft, impdao } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Start the mints
    await impishSpiral.startMints();

    let mintPrice = await impishSpiral.getMintPrice();
    await expect(await impishSpiral.mintSpiralRandom({ value: mintPrice.mul(2) })).to.changeEtherBalance(
      wallet,
      -mintPrice
    );

    // Mint via RWNFT
    const rwNFTID = await rwnft.nextTokenId();
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    expect(await rwnft.ownerOf(rwNFTID)).to.be.equal(wallet.address);

    mintPrice = await impishSpiral.getMintPrice();
    await expect(await impishSpiral.mintSpiralWithRWNFT(rwNFTID, { value: mintPrice.mul(5) })).to.changeEtherBalance(
      wallet,
      -mintPrice
    );
    // Make sure we got the correct impish tokens
    expect(await impdao.balanceOf(wallet.address)).to.be.equal(mintPrice.mul(33 * 1000).div(100));
  });

  it("Should allow a mix of NFTs to win", async function () {
    const { impishSpiral, impdao, rwnft } = await loadContracts();
    const provider = waffle.provider;

    // Get 10 wallets
    const signers = (await ethers.getSigners()).slice(0, 10);
    const wallet = signers[0];

    // Start the mints
    await impishSpiral.startMints();

    // Mint 20 Random Spirals first
    let expectedBal = BigNumber.from(0);
    for (let i = 0; i < 20; i++) {
      expectedBal = expectedBal.add(await impishSpiral.getMintPrice());
      await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    }

    const startBal = await provider.getBalance(impishSpiral.address);
    expect(startBal).to.be.equals(expectedBal);

    // Now, the first 5 signers mint random Spirals
    for (let i = 0; i < 5; i++) {
      const mintPrice = await impishSpiral.getMintPrice();
      const expectedToken = await impishSpiral._tokenIdCounter();
      await impishSpiral.connect(signers[i]).mintSpiralRandom({ value: mintPrice });
      expect(await impishSpiral.ownerOf(expectedToken)).to.be.equal(signers[i].address);
    }

    // The next 10 signers mint RandomWalkNFT spirals
    // First, get all the 5 to mint a RWNFT
    const rwTokenIDs = [];
    for (let i = 5; i < 10; i++) {
      rwTokenIDs.push(await rwnft.nextTokenId());
      await rwnft.connect(signers[i]).mint({ value: await rwnft.getMintPrice() });
      expect(await rwnft.ownerOf(rwTokenIDs[rwTokenIDs.length - 1])).to.be.equal(signers[i].address);
    }

    // Now, mint the Companions
    let impishDAOFunds = BigNumber.from(0);
    for (let i = 5; i < 10; i++) {
      const mintPrice = await impishSpiral.getMintPrice();
      const expectedToken = await impishSpiral._tokenIdCounter();

      await impishSpiral.connect(signers[i]).mintSpiralWithRWNFT(rwTokenIDs[i - 5], { value: mintPrice });
      expect(await impishSpiral.ownerOf(expectedToken), "Wrong token owner").to.be.equal(signers[i].address);

      // Make sure we got the IMPISH tokens
      const impishETH = mintPrice.mul(33).div(100);
      impishDAOFunds = impishDAOFunds.add(impishETH);
      expect(await impdao.balanceOf(signers[i].address), "Wrong IMPISH bal").to.be.equal(impishETH.mul(1000));

      // And that the seeds are the same
      expect(await rwnft.seeds(rwTokenIDs[i - 5])).to.be.equal(await impishSpiral.spiralSeeds(expectedToken));
    }

    // Move forward
    await network.provider.send("evm_increaseTime", [1 + 3600 * 24 * 3]); // 3 days + 1 sec
    await network.provider.send("evm_mine");

    const totalReward = await impishSpiral.totalReward();

    // Now, claim the winnings
    let rewardsClaimed = BigNumber.from(0);
    const lastTokenID = (await impishSpiral._tokenIdCounter()).sub(1);
    for (let i = 0; i < 10; i++) {
      const expectedReward = totalReward.mul(i + 1).div(100);
      rewardsClaimed = rewardsClaimed.add(expectedReward);

      const winningTokenID = lastTokenID.sub(9 - i);

      // Note that anyone can claim win, no need for connect() here
      await expect(await impishSpiral.claimWin(winningTokenID), `Didn't get Reward for ${i}`).to.changeEtherBalance(
        signers[i],
        expectedReward
      );

      expect(await impishSpiral.winningsClaimed(winningTokenID)).to.be.equal(true);

      // Claiming it again should be error
      await expect(impishSpiral.claimWin(winningTokenID)).to.be.revertedWith("Claimed");
    }

    // Now claim the developer fee
    const actualDevFee = totalReward.sub(rewardsClaimed).sub(impishDAOFunds);
    await expect(await impishSpiral.afterAllWinnings()).to.changeEtherBalance(wallet, actualDevFee);

    // Now should be empty
    await expect(impishSpiral.afterAllWinnings()).to.be.revertedWith("Empty");
  });

  it("Should work with base URLs", async function () {
    const { impishSpiral } = await loadContracts();
    // eslint-disable-next-line no-unused-vars
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    await expect(impishSpiral.connect(otherSigner).setBaseURI("wrong URI")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Set base URI as owner works
    const baseURI = "https://impishdao.com//spiralapi/spirals/metadata/";
    await impishSpiral.setBaseURI(baseURI);

    const tokenID = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    expect(await impishSpiral.tokenURI(tokenID)).to.be.equal(baseURI + tokenID.toString());
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
    await expect(impishSpiral.removeLengthFromSpiral(0, 700000)).to.be.revertedWith("CantTrim");
    await expect(impishSpiral.addLengthToSpiral(0, 10000000)).to.be.revertedWith("CantAdd");
  });
});

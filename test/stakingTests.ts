/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { SpiralStaking } from "../typechain/SpiralStaking";

import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  spiralstaking: SpiralStaking;
};

describe("SpiralStaking", function () {
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

    // Allow spiral staking to mint spiralbits
    spiralbits.addAllowedMinter(spiralstaking.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, spiralstaking };
  }

  it("Simple Staking - Win while staked", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake
    await spiralstaking.stakeNFTs([tokenId]);

    // Now, fast forward 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 4]); // 4 days
    await network.provider.send("evm_mine");

    // Now the spiral game is won. Try to claim the prize, this should fail
    // because the staking contract will refuse to accept the prize money
    await expect(impishSpiral.claimWin(tokenId)).to.be.revertedWith("Transfer failed.");

    // Unstake it, and then claim the win, that should work
    await spiralstaking.unstakeNFTs([tokenId], false);
    await impishSpiral.claimWin(tokenId);

    // And then afterall winnings should work
    await impishSpiral.afterAllWinnings();
  });

  it("Simple Staking - Unstaking", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake
    await spiralstaking.stakeNFTs([tokenId]);

    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
    expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);
    expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals([BigNumber.from(tokenId)]);

    // Unstake
    await spiralstaking.unstakeNFTs([tokenId], false);
    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
    expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Should allow for pausing", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    // eslint-disable-next-line no-unused-vars
    const [signer, otherSigner] = await ethers.getSigners();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint random and stake it
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await spiralstaking.stakeNFTsForOwner([tokenId], otherSigner.address);

    // Pause the contract
    // Only owner can pause
    await expect(spiralstaking.connect(otherSigner).pause()).to.be.revertedWith("Ownable: caller is not the owner");
    await spiralstaking.pause(); // This should succeed

    // Mint second
    // Mint random and stake it
    const tokenId2 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Now staking should fail
    await expect(spiralstaking.stakeNFTsForOwner([tokenId2], otherSigner.address)).to.be.revertedWith("Paused");

    // But we should be able to withdraw it
    await spiralstaking.connect(otherSigner).unstakeNFTs([tokenId], false);

    expect(await spiralstaking.paused()).to.be.equals(true);
    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(otherSigner.address);
    expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    expect((await spiralstaking.walletOfOwner(otherSigner.address)).length).to.be.deep.equals(0);
  });

  it("Simple Staking - Different owner", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    // eslint-disable-next-line no-unused-vars
    const [signer, otherSigner] = await ethers.getSigners();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake on behalf of otherSigner
    await spiralstaking.stakeNFTsForOwner([tokenId], otherSigner.address);

    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
    expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(otherSigner.address);
    expect(await spiralstaking.walletOfOwner(otherSigner.address)).to.be.deep.equals([BigNumber.from(tokenId)]);

    // Only the otherSigner can unstake or withdraw
    await expect(spiralstaking.unstakeNFTs([tokenId], false)).to.be.revertedWith("NotYours");

    // Unstake
    await spiralstaking.connect(otherSigner).unstakeNFTs([tokenId], false);

    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(otherSigner.address);
    expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    expect((await spiralstaking.walletOfOwner(otherSigner.address)).length).to.be.deep.equals(0);
  });

  it("Staking 1-by-1 - Unstaking all", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint 10 and stake them one-by-one
    const stakedTokenIds = [];
    for (let i = 0; i < 10; i++) {
      // Mint random
      const tokenId = await impishSpiral._tokenIdCounter();
      stakedTokenIds.push(tokenId);
      await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

      // Stake
      await spiralstaking.stakeNFTs([tokenId]);

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
      expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);
      expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals(stakedTokenIds);
    }

    // Unstake all at once.
    await spiralstaking.unstakeNFTs(stakedTokenIds, false);
    for (let i = 0; i < 10; i++) {
      const tokenId = stakedTokenIds[i];

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
      expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    }
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Staking all - Unstaking 1-by-1", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint 10 and stake them all at once
    const stakedTokenIds = [];
    for (let i = 0; i < 10; i++) {
      // Mint random
      const tokenId = await impishSpiral._tokenIdCounter();
      stakedTokenIds.push(tokenId);
      await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    }

    // Stake all 10
    await spiralstaking.stakeNFTs(stakedTokenIds);

    // Assert they got staked.
    for (let i = 0; i < 10; i++) {
      const tokenId = stakedTokenIds[i];

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
      expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);
      expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals(stakedTokenIds);
    }

    // Unstake one-by-one
    for (let i = 0; i < 10; i++) {
      const tokenId = stakedTokenIds[i];
      await spiralstaking.unstakeNFTs([tokenId], false);

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
      expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
      expect(new Set(await spiralstaking.walletOfOwner(wallet.address))).to.be.deep.equals(
        new Set(stakedTokenIds.slice(i + 1, 10))
      );
    }
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Staking Unstaking Complex", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint 10 and stake them all at once
    let stakedTokenIds: Array<BigNumber> = [];
    for (let i = 0; i < 10; i++) {
      // Mint random
      const tokenId = await impishSpiral._tokenIdCounter();
      stakedTokenIds.push(tokenId);
      await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    }

    // To start, Stake all 10
    await spiralstaking.stakeNFTs(stakedTokenIds);

    // Assert they got staked.
    for (let i = 0; i < 10; i++) {
      const tokenId = stakedTokenIds[i];

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
      expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);
      expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals(stakedTokenIds);
    }

    // Now, stake 1, unstake 1
    for (let i = 0; i < 10; i++) {
      // Mint random
      const tokenId = await impishSpiral._tokenIdCounter();
      stakedTokenIds.push(tokenId);
      await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

      // And stake it
      await spiralstaking.stakeNFTs([tokenId]);
      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
      expect((await spiralstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);
      expect(new Set(await spiralstaking.walletOfOwner(wallet.address)), "post stake").to.be.deep.equals(
        new Set(stakedTokenIds)
      );

      // Unstake every even one
      const unstakedTokenId = BigNumber.from(i).mul(2);
      await spiralstaking.unstakeNFTs([unstakedTokenId], false);
      expect(await impishSpiral.ownerOf(unstakedTokenId)).to.be.equals(wallet.address);
      expect(BigNumber.from((await spiralstaking.stakedTokenOwners(unstakedTokenId)).owner)).to.be.equals(0);

      const expectedStakedWallet = new Set(stakedTokenIds.map((n) => n.toNumber()));
      // remove all even ones so far
      for (let j = 0; j < i + 1; j++) {
        expectedStakedWallet.delete(j * 2);
      }

      const actualStakedWallet = new Set((await spiralstaking.walletOfOwner(wallet.address)).map((n) => n.toNumber()));
      expect(actualStakedWallet).to.be.deep.equals(expectedStakedWallet);

      // Update the stakedTokenIds array to remove the unstaked one
      stakedTokenIds = [...expectedStakedWallet].map((n) => BigNumber.from(n));
    }

    // Now, only the odd numbered tokens are staked.
    // Unstake them all at once.
    await spiralstaking.unstakeNFTs(stakedTokenIds, false);
    for (let i = 0; i < 10; i++) {
      const tokenId = stakedTokenIds[i];

      expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
      expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    }
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Staking - Negative tests", async function () {
    const { impishSpiral, spiralstaking } = await loadContracts();
    // eslint-disable-next-line no-unused-vars
    const [signer, otherSigner] = await ethers.getSigners();

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Can't stake without approving first
    await expect(spiralstaking.stakeNFTs([tokenId])).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );

    // Approve to stake
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    const otherTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.connect(otherSigner).mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Try to stake a wrong token.
    await expect(spiralstaking.stakeNFTs([otherTokenId])).to.be.revertedWith("DontOwnToken");
    await expect(spiralstaking.stakeNFTs([tokenId, otherTokenId])).to.be.revertedWith("DontOwnToken");

    // Non existent token
    await expect(spiralstaking.stakeNFTs([otherTokenId.add(1)])).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    // This one will work
    await spiralstaking.stakeNFTs([tokenId]);

    // Try to stake again
    await expect(spiralstaking.stakeNFTs([tokenId])).to.be.revertedWith("DontOwnToken");

    // Try to unstake wrong token
    await expect(spiralstaking.unstakeNFTs([otherTokenId], false)).to.be.revertedWith("NotStaked");

    // Non existent token
    await expect(spiralstaking.unstakeNFTs([otherTokenId.add(1)], false)).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    // Stake the other token
    await impishSpiral.connect(otherSigner).approve(spiralstaking.address, otherTokenId);
    await spiralstaking.connect(otherSigner).stakeNFTs([otherTokenId]);

    // Unstake from the wrong address shouldn't work
    await expect(spiralstaking.connect(otherSigner).unstakeNFTs([tokenId], false)).to.be.revertedWith("NotYours");

    // Unstake the non-owned token can't work
    await expect(spiralstaking.unstakeNFTs([otherTokenId], false)).to.be.revertedWith("NotYours");
    await expect(spiralstaking.unstakeNFTs([tokenId, otherTokenId], false)).to.be.revertedWith("NotYours");

    // Finally this will work for both
    await spiralstaking.unstakeNFTs([tokenId], false);
    await spiralstaking.connect(otherSigner).unstakeNFTs([otherTokenId], false);

    // Unstake again
    await expect(spiralstaking.unstakeNFTs([tokenId], false)).to.be.revertedWith("NotStaked");
  });
});

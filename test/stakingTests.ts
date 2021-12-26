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

describe.only("SpiralStaking", function () {
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
    const spiralstaking = await SpiralStaking.deploy(impishSpiral.address, spiralbits.address);
    await spiralstaking.deployed();

    // Allow spiral staking to mint spiralbits
    spiralbits.addAllowedMinter(spiralstaking.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, spiralstaking };
  }

  it("Simple Staking - Unstaking", async function () {
    const { impishSpiral, impdao, rwnft, spiralbits, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake
    await spiralstaking.stakeSpirals([tokenId]);

    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(spiralstaking.address);
    expect(await spiralstaking.isSpiralStaked(tokenId)).to.be.equals(wallet.address);
    expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals([BigNumber.from(0)]); // TokenId is correctly owned

    // Unstake
    await spiralstaking.unstakeSpirals([tokenId], false);
    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
    expect(BigNumber.from(await spiralstaking.isSpiralStaked(tokenId))).to.be.equals(0);
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Staking - Negative tests", async function () {
    const { impishSpiral, impdao, rwnft, spiralbits, spiralstaking } = await loadContracts();
    const provider = waffle.provider;
    const [signer, otherSigner] = await ethers.getSigners();

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Can't stake without approving first
    await expect(spiralstaking.stakeSpirals([tokenId])).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );

    // Approve to stake
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);

    const otherTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.connect(otherSigner).mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Try to stake a wrong token.
    await expect(spiralstaking.stakeSpirals([otherTokenId])).to.be.revertedWith("DontOwnToken");
    await expect(spiralstaking.stakeSpirals([tokenId, otherTokenId])).to.be.revertedWith("DontOwnToken");

    // Non existant token
    await expect(spiralstaking.stakeSpirals([otherTokenId.add(1)])).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    // This one will work
    await spiralstaking.stakeSpirals([tokenId]);

    // Try to unstake wrong token
    await expect(spiralstaking.unstakeSpirals([otherTokenId], false)).to.be.revertedWith("NotYours");

    // Non existant token
    await expect(spiralstaking.unstakeSpirals([otherTokenId.add(1)], false)).to.be.revertedWith("NotYours");

    // Stake the other token
    await impishSpiral.connect(otherSigner).approve(spiralstaking.address, otherTokenId);
    await spiralstaking.connect(otherSigner).stakeSpirals([otherTokenId]);

    // Unstake the non-owned token can't work
    await expect(spiralstaking.unstakeSpirals([otherTokenId], false)).to.be.revertedWith("NotYours");
    await expect(spiralstaking.unstakeSpirals([tokenId, otherTokenId], false)).to.be.revertedWith("NotYours");

    // Finally this will work for both
    await spiralstaking.unstakeSpirals([tokenId], false);
    await spiralstaking.connect(otherSigner).unstakeSpirals([otherTokenId], false);
  });
});

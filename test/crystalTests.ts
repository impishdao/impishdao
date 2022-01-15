/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { ImpishCrystal } from "../typechain/ImpishCrystal";
import type { SpiralStaking } from "../typechain/SpiralStaking";
import type { SpiralBits } from "../typechain/SpiralBits";
import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  crystal: ImpishCrystal;
  spiralStaking: SpiralStaking;
};

describe.only("ImpishSpiral", function () {
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

    await impishSpiral.startMints();

    const SpiralBits = await ethers.getContractFactory("SpiralBits");
    const spiralbits = await SpiralBits.deploy();
    await spiralbits.deployed();

    const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
    const spiralStaking = await SpiralStaking.deploy(impishSpiral.address, spiralbits.address, rwnft.address);
    await spiralStaking.deployed();

    const Crystal = await ethers.getContractFactory("ImpishCrystal");
    const crystal = await Crystal.deploy(impishSpiral.address, spiralStaking.address, spiralbits.address);

    return { impishSpiral, impdao, rwnft, spiralbits, spiralStaking, crystal };
  }

  it("Initial + later mints", async function () {
    const { impishSpiral, impdao, rwnft, crystal } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Assert the first 100 crystals were minted to the wallet
    const initial = await crystal.walletOfOwner(signer.address);
    expect(initial.length).to.be.equals(100);

    for (let i = 0; i < 100; i++) {
      const crystalInfo = await crystal.crystals(0);
      expect(crystalInfo.size).to.be.equals(30);
      expect(crystalInfo.generation).to.be.equals(0);
      expect(crystalInfo.sym).to.be.closeTo(6, 2);
      expect(crystalInfo.spiralBitsStored).to.be.equals(0);
    }

    // Mint a new Spiral
    let spiralTokenId =  await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({value: await impishSpiral.getMintPrice()});
    await crystal.mintCrystals([spiralTokenId], 0);
    const crystalTokenId = 100;
    const crystalInfo = await crystal.crystals(100);
    expect(crystalInfo.size).to.be.equals(30);
    expect(crystalInfo.generation).to.be.equals(0);
    expect(crystalInfo.sym).to.be.closeTo(6, 2);
    expect(crystalInfo.spiralBitsStored).to.be.equals(0);

    // Can't mint same spiral same gen
    await expect(crystal.mintCrystals([spiralTokenId], 0)).to.be.revertedWith("AlreadyMintedThisGen");

    // Can't mint invalid spiral
    await expect(crystal.mintCrystals([1000], 0)).to.be.revertedWith("ERC721: owner query for nonexistent token");

    // Can't mint wrong gen
    await expect(crystal.mintCrystals([spiralTokenId], 5)).to.be.revertedWith("InvalidGen");

    // Can't mint with someone else's spiral
    const otherSpiralId = await impishSpiral._tokenIdCounter();
    await impishSpiral.connect(otherSigner).mintSpiralRandom({value: await impishSpiral.getMintPrice()});
    await expect(crystal.mintCrystals([otherSpiralId], 0)).to.be.revertedWith("NotOwnerOrStaker");

    // Can't mint gen 1 with no ETH
    await expect(crystal.mintCrystals([spiralTokenId], 1)).to.be.revertedWith("NotEnoughETH");

    const expectedPrices = [ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.1"), ethers.utils.parseEther("1"), ethers.utils.parseEther("10")];
    for (let i = 0; i < expectedPrices.length; i++) {
      await expect(crystal.mintCrystals([spiralTokenId], 1+i, {value: expectedPrices[i].sub(1)})).to.be.revertedWith("NotEnoughETH");
      await expect(crystal.mintCrystals([spiralTokenId], 1+i, {value: expectedPrices[i].add(1)})).to.be.revertedWith("NotEnoughETH");
      
      const crystalId = await crystal._tokenIdCounter();
      await crystal.mintCrystals([spiralTokenId], 1+i, {value: expectedPrices[i]});
      expect(await crystal.ownerOf(crystalId)).to.be.equal(signer.address);
      const crystalInfo = await crystal.crystals(crystalId);
      expect(crystalInfo.generation).to.be.equals(i+1);
    }
  });

});

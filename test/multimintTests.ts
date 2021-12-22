/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { MultiMint } from "../typechain/MultiMint";
import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  multimint: MultiMint;
};

describe.only("MultiMint", function () {
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

    const MultiMint = await ethers.getContractFactory("MultiMint");
    const multimint = await MultiMint.deploy(impishSpiral.address);
    await multimint.deployed();

    return { impishSpiral, impdao, rwnft, multimint };
  }

  it("Should mint multiple", async function () {
    const { impishSpiral, multimint } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Start the mints
    await impishSpiral.startMints();

    // Mint 10 random
    let amountNeeded = BigNumber.from(0);
    let mintPrice = await impishSpiral.getMintPrice();
    for (let i = 0; i < 10; i++) {
      amountNeeded = amountNeeded.add(mintPrice);
      // Mint price increases 0.5% everytime
      mintPrice = mintPrice.mul(1005).div(1000);
    }

    await multimint.multiMint(10, { value: amountNeeded });

    // Make sure we have all 10 Spirals
    for (let i = 0; i < 10; i++) {
      expect(await impishSpiral.ownerOf(i)).to.be.equal(wallet.address);
    }

    // Can't mint 0 spirals
    await expect(multimint.multiMint(0, { value: 1 })).to.be.revertedWith("AtLeastOne");

    // Not more than 10
    await expect(multimint.multiMint(20, { value: 1 })).to.be.revertedWith("AtMost10");
  });
});

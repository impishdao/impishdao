/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralMarket } from "../typechain/SpiralMarket";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralMarket: SpiralMarket;
};

describe("SpiralMarket", function () {
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

    const SpiralMarket = await ethers.getContractFactory("SpiralMarket");
    const spiralMarket = await SpiralMarket.deploy(impishSpiral.address);
    await spiralMarket.deployed();

    return { impishSpiral, impdao, rwnft, spiralMarket };
  }

  it("Should be able to buy and sell", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // Even after listing, NFT is still with wallet
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Then the other guy can buy it
    await expect(
      await spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })
    ).to.changeEtherBalances([signer, otherSigner], [price, -price]);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(otherSigner.address);
  });

  it("Should be able to buy and sell negative tests", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Can't list with 0 price
    await expect(spiralMarket.listSpiral(spiralTokenId, 0)).to.be.revertedWith("NeedPrice");

    // Try to list non existing token
    await expect(spiralMarket.listSpiral(100, 1)).to.be.revertedWith("ERC721: owner query for nonexistent token");

    // Listing a token that we don't own can't succeed
    const otherSpiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.connect(otherSigner).mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await expect(spiralMarket.listSpiral(otherSpiralTokenId, 1)).to.be.revertedWith("TokenNotOwned");

    // Listing for sale without approval should revert
    await expect(spiralMarket.listSpiral(spiralTokenId, 1)).to.be.revertedWith("NotApproved");

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // The other Token is not listed for sale, so we can't buy it
    await expect(spiralMarket.buySpiral(otherSpiralTokenId, { value: 100 })).to.be.revertedWith("NotListed");

    // Can't buy token with wrong price
    await expect(spiralMarket.buySpiral(spiralTokenId, { value: 1 })).to.be.revertedWith("IncorrectETH");
    await expect(spiralMarket.buySpiral(spiralTokenId, { value: price.add(1) })).to.be.revertedWith("IncorrectETH");

    // Then the other guy can buy the listed Token
    await expect(
      await spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })
    ).to.changeEtherBalances([signer, otherSigner], [price, -price]);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(otherSigner.address);
  });

  it("Should be able to cancel listing", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner, thirdSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // List the spiral

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // Listing should be valid
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(true);

    // But cancel the listing
    await spiralMarket.cancelListing(spiralTokenId);

    // Listing should be invalid after cancel
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(false);

    // Can't buy now
    await expect(spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })).to.be.revertedWith(
      "NotListed"
    );

    // List it again
    await spiralMarket.listSpiral(spiralTokenId, price);

    // But transfer the token to someone else
    await impishSpiral.transferFrom(signer.address, thirdSigner.address, spiralTokenId);

    // Listing should be invalid
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(false);

    // Can't buy it, since owner changed
    await expect(spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })).to.be.revertedWith(
      "OwnerChanged"
    );
  });

  it("Should be able to unapprove listing", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // Listing should be valid
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(true);

    // But now un-approve it
    await impishSpiral.setApprovalForAll(spiralMarket.address, false);

    // Listing should be invalid after unapproval
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(false);

    // Can't buy because owner revoked approval
    await expect(spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })).to.be.revertedWith(
      "NotApproved"
    );

    // Approve again
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // Now listing is valid, and can buy it
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(true);
    await expect(
      await spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })
    ).to.changeEtherBalances([signer, otherSigner], [price, -price]);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(otherSigner.address);
  });

  it("Should be able to change price", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const oldPrice = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, oldPrice);

    // Change the price
    const newPrice = ethers.utils.parseEther("0.000020");
    await spiralMarket.listSpiral(spiralTokenId, newPrice);

    // Listing should be valid
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(true);

    // But can't buy at old price
    await expect(spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: oldPrice })).to.be.revertedWith(
      "IncorrectETH"
    );

    // But can buy at new price
    await expect(
      await spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: newPrice })
    ).to.changeEtherBalances([signer, otherSigner], [newPrice, -newPrice]);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(otherSigner.address);
  });

  it("Should be able to buy from yourself", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(true);

    // Buy from yourself, and net ETH balance should change 0
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);
    await expect(await spiralMarket.buySpiral(spiralTokenId, { value: price })).to.changeEtherBalance(signer, 0);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);
  });

  it("Should be able to pause", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // Only owner can pause
    await expect(spiralMarket.connect(otherSigner).pauseContract()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Pause the contract
    await spiralMarket.pauseContract();

    // Listing should be invalid
    expect(await spiralMarket.isListingValid(spiralTokenId)).to.be.equal(false);

    // Now can't buy
    await expect(spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })).to.be.revertedWith(
      "Paused"
    );

    // Or update listing
    await expect(spiralMarket.listSpiral(spiralTokenId, price.add(1))).to.be.revertedWith("Paused");
  });

  it("Should be able to set fees", async function () {
    const { spiralMarket, impishSpiral } = await loadContracts();
    const [signer, otherSigner] = await ethers.getSigners();
    const provider = waffle.provider;

    // Start the mints
    await impishSpiral.startMints();

    // Mint a spiral
    const spiralTokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(signer.address);

    // Approve for spending on the market
    await impishSpiral.setApprovalForAll(spiralMarket.address, true);

    // List for sale
    const price = ethers.utils.parseEther("0.000015");
    await spiralMarket.listSpiral(spiralTokenId, price);

    // Only owner can change fees
    await expect(spiralMarket.connect(otherSigner).setFeeRate(100)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // Can't set too high fees (20% is too high)
    await expect(spiralMarket.setFeeRate(20 * 200)).to.be.revertedWith("BadFee");

    // Can set a modest 2% fee
    await spiralMarket.setFeeRate(2 * 100);

    // Now, buying it should charge fees
    const expectedFee = price.mul(200).div(10000);
    const expectedSellerEth = price.sub(expectedFee);

    // Buy it
    await expect(
      await spiralMarket.connect(otherSigner).buySpiral(spiralTokenId, { value: price })
    ).to.changeEtherBalances([signer, otherSigner], [expectedSellerEth, -price]);
    expect(await impishSpiral.ownerOf(spiralTokenId)).to.be.equal(otherSigner.address);

    // The fee should be in the contract
    expect(await provider.getBalance(spiralMarket.address)).to.be.equal(expectedFee);

    // And can be withdrawn at any time.
    await expect(await spiralMarket.withdrawFees()).to.changeEtherBalance(signer, expectedFee);
  });
});

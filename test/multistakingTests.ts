/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { SpiralStaking } from "../typechain/SpiralStaking";

import { BigNumber } from "ethers";
import { RWNFTStaking } from "../typechain";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  spiralstaking: SpiralStaking;
  rwnftstaking: RWNFTStaking;
};

describe("MultiStaking", function () {
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

    const RwnftStaking = await ethers.getContractFactory("RWNFTStaking");
    const rwnftstaking = await RwnftStaking.deploy(impishSpiral.address, spiralbits.address, rwnft.address);
    await rwnftstaking.deployed();

    await spiralstaking.setRwNFTStakingContract(rwnftstaking.address);
    await rwnftstaking.setSpiralStakingContract(spiralstaking.address);

    // Allow spiral staking to mint spiralbits
    await spiralbits.addAllowedMinter(spiralstaking.address);
    await spiralbits.addAllowedMinter(rwnftstaking.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, spiralstaking, rwnftstaking };
  }

  it("Simple Staking - Unstaking", async function () {
    const { impishSpiral, rwnft, spiralstaking, rwnftstaking } = await loadContracts();
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

    // TokenId is correctly owned
    expect(await spiralstaking.walletOfOwner(wallet.address)).to.be.deep.equals([BigNumber.from(tokenId)]);

    // Unstake
    await spiralstaking.unstakeNFTs([tokenId], false);
    expect(await impishSpiral.ownerOf(tokenId)).to.be.equals(wallet.address);
    expect(BigNumber.from((await spiralstaking.stakedTokenOwners(tokenId)).owner)).to.be.equals(0);
    expect((await spiralstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);

    // Stake RandomWalkNFT
    await rwnft.setApprovalForAll(rwnftstaking.address, true);
    const rwnftID = await rwnft.nextTokenId();
    await rwnft.mint({ value: await rwnft.getMintPrice() });

    // Stake
    await rwnftstaking.stakeNFTs([rwnftID]);

    expect(await rwnft.ownerOf(tokenId)).to.be.equals(rwnftstaking.address);
    expect((await rwnftstaking.stakedTokenOwners(tokenId)).owner).to.be.equals(wallet.address);

    // TokenId is correctly owned
    expect(await rwnftstaking.walletOfOwner(wallet.address)).to.be.deep.equals([BigNumber.from(rwnftID)]);

    // Unstake
    await rwnftstaking.unstakeNFTs([rwnftID], false);
    expect(await rwnft.ownerOf(tokenId)).to.be.equals(wallet.address);
    expect(BigNumber.from((await rwnftstaking.stakedTokenOwners(rwnftID)).owner)).to.be.equals(0);
    expect((await rwnftstaking.walletOfOwner(wallet.address)).length).to.be.deep.equals(0);
  });

  it("Get correct SPIRALBITS", async function () {
    const { impishSpiral, rwnft, spiralstaking, spiralbits, rwnftstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Assert the 100M has been minted to wallet, and burn it to make rest of the calculations easy in this
    // test
    expect(await spiralbits.balanceOf(wallet.address)).to.be.equal(
      BigNumber.from(100 * Math.pow(10, 6)).mul(BigNumber.from(10).pow(18)) // 100M
    );
    await spiralbits.burn(await spiralbits.balanceOf(wallet.address));

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);
    await rwnft.setApprovalForAll(rwnftstaking.address, true);

    // Mint 2 each of RandomWalkNFT and Spirals
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await impishSpiral.mintSpiralRandom({ value: impishSpiral.getMintPrice() });
    await impishSpiral.mintSpiralRandom({ value: impishSpiral.getMintPrice() });

    // Stake 1 of each
    await spiralstaking.stakeNFTs([0]);
    await rwnftstaking.stakeNFTs([0]);

    // The bonus % for both should be 50%
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(50 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(50 * 100);

    // Fast forward 100s
    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    // 100 * 0.167
    const expectedSpiralClaimsGwei = ethers.utils.parseEther("0.167").mul(100).div(Math.pow(10, 15));
    const actualSpiralClaimsGwei = (await spiralstaking.claimsPending(wallet.address)).div(Math.pow(10, 15));
    expect(actualSpiralClaimsGwei).to.be.closeTo(expectedSpiralClaimsGwei, 168); // 168 is 1%

    const expectedRwnftClaimsGwei = ethers.utils.parseEther("0.0167").mul(100).div(Math.pow(10, 15));
    const actualRwnftClaimsGwei = (await rwnftstaking.claimsPending(wallet.address)).div(Math.pow(10, 15));
    expect(actualRwnftClaimsGwei).to.be.closeTo(expectedRwnftClaimsGwei, 17); // 17 is 1%

    {
      // When we withdraw, we should get 50% more, because of the bonus
      const bonusExpectedGwei = expectedSpiralClaimsGwei.mul(50).div(100);
      await spiralstaking.unstakeNFTs([], true);
      expect((await spiralbits.balanceOf(wallet.address)).div(Math.pow(10, 15)).toNumber()).to.be.closeTo(
        expectedSpiralClaimsGwei.add(bonusExpectedGwei).toNumber(),
        550
      );
    }

    // Burn any spiralbits to make calculations easier
    await spiralbits.burn(await spiralbits.balanceOf(wallet.address));

    // For RWNFT
    {
      const bonusExpectedGwei = expectedRwnftClaimsGwei.mul(50).div(100);
      await rwnftstaking.unstakeNFTs([], true);
      expect((await spiralbits.balanceOf(wallet.address)).div(Math.pow(10, 15)).toNumber()).to.be.closeTo(
        expectedRwnftClaimsGwei.add(bonusExpectedGwei).toNumber(),
        550
      );
    }
  });

  it("Get correct SPIRALBITS bonus%", async function () {
    const { impishSpiral, rwnft, spiralstaking, spiralbits, rwnftstaking } = await loadContracts();
    const provider = waffle.provider;
    const [wallet] = provider.getWallets();

    // Assert the 100M has been minted to wallet, and burn it to make rest of the calculations easy in this
    // test
    expect(await spiralbits.balanceOf(wallet.address)).to.be.equal(
      BigNumber.from(100 * Math.pow(10, 6)).mul(BigNumber.from(10).pow(18)) // 100M
    );
    await spiralbits.burn(await spiralbits.balanceOf(wallet.address));

    // Approve staking
    await impishSpiral.setApprovalForAll(spiralstaking.address, true);
    await rwnft.setApprovalForAll(rwnftstaking.address, true);

    // Mint 2 each of RandomWalkNFT and Spirals
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await impishSpiral.mintSpiralRandom({ value: impishSpiral.getMintPrice() });
    await impishSpiral.mintSpiralRandom({ value: impishSpiral.getMintPrice() });

    // With nothing staked, bonus should be 0
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(0);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(0);

    // Stake 1 RWNFT, bonus should be 50% for spirals
    await rwnftstaking.stakeNFTs([0]);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(50 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(0);

    // Stake 2 RWNFT, bonus should be 100% for spirals
    await rwnftstaking.stakeNFTs([1]);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(100 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(0);

    // Stake 1 Spiral, bonus should be 50% for RWNFT
    await spiralstaking.stakeNFTs([0]);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(100 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(50 * 100);

    // Stake 2 Spiral, bonus should be 100%
    await spiralstaking.stakeNFTs([1]);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(100 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(100 * 100);

    // Unstake 1 of each, bonus should be back to 50%
    await spiralstaking.unstakeNFTs([0], false);
    await rwnftstaking.unstakeNFTs([1], false);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(50 * 100);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(50 * 100);

    // Unstake all, bonus should be 0%
    await spiralstaking.unstakeNFTs([1], false);
    await rwnftstaking.unstakeNFTs([0], false);
    expect(await spiralstaking.currentBonusInBips()).to.be.equal(0);
    expect(await rwnftstaking.currentBonusInBips()).to.be.equal(0);
  });
});

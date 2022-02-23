/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { ImpishCrystal } from "../typechain/ImpishCrystal";
import type { StakingV2 } from "../typechain/StakingV2";

import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  crystal: ImpishCrystal;
  stakingv2: StakingV2;
};

describe("SpiralStaking V2", function () {
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
    spiralbits.addAllowedMinter(stakingv2.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, crystal, stakingv2 };
  }

  it("Simple Staking V2", async function () {
    const { impdao, rwnft, impishSpiral, crystal, spiralbits, stakingv2 } = await loadContracts();
    const [signer] = await ethers.getSigners();

    const Eth100 = ethers.utils.parseEther("100");

    // Approve and stake spiralbits
    await spiralbits.approve(stakingv2.address, Eth100);
    await stakingv2.stakeSpiralBits(Eth100);

    // Immediately unstaking means we don't get any spiralbits rewards
    await expect(() => stakingv2.unstakeSpiralBits(false)).to.changeTokenBalance(spiralbits, signer, Eth100);

    // Approve IMPISH
    await impdao.approve(stakingv2.address, Eth100);
    await impdao.deposit({ value: Eth100 });
    await stakingv2.stakeImpish(Eth100);

    // 1 day later
    await network.provider.send("evm_increaseTime", [3600 * 24 * 1]);
    await network.provider.send("evm_mine");

    // Unstaking Impish should generate some spiralbits
    const beforeSpiralBits = await spiralbits.balanceOf(signer.address);
    await expect(() => stakingv2.unstakeImpish(true)).to.changeTokenBalance(impdao, signer, Eth100);
    const afterSpiralBits = await spiralbits.balanceOf(signer.address);
    expect(afterSpiralBits.sub(beforeSpiralBits).div(BigNumber.from(10).pow(18)).toNumber()).to.be.closeTo(
      1 * 3600 * 24 * 1.0, // 1 SPIRALBIT per sec * one day * 100% of rewards
      30
    );

    // Stake all NFTs

    // 1. Randomwalks
    const rwID = await rwnft.nextTokenId();
    await rwnft.mint({ value: await rwnft.getMintPrice() });
    await rwnft.setApprovalForAll(stakingv2.address, true);
    await stakingv2.stakeNFTsForOwner([rwID.add(1000000)], signer.address);
    expect(await stakingv2.walletOfOwner(signer.address)).to.be.deep.equals([rwID.add(1000000)]);
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numRWStaked).to.be.equals(1);

    // 2. Spiral (and mint crystal before staking)
    const spiralId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    const gcrystalId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([spiralId], 0);
    await impishSpiral.setApprovalForAll(stakingv2.address, true);
    await stakingv2.stakeNFTsForOwner([spiralId.add(2000000)], signer.address);
    let walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [rwID.add(1000000), spiralId.add(2000000)].forEach((cid) => {
      expect(walletOfOwner.findIndex((n) => n.eq(cid))).to.be.gte(0);
    });
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numSpiralsStaked).to.be.equals(1);

    // 3. Growing Crystal.
    await crystal.setApprovalForAll(stakingv2.address, true);
    await stakingv2.stakeNFTsForOwner([gcrystalId + 3000000], signer.address);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [rwID.add(1000000), spiralId.add(2000000), BigNumber.from(gcrystalId + 3000000)].forEach((cid) => {
      expect(walletOfOwner.findIndex((n) => n.eq(cid))).to.be.gte(0);
    });
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numGrowingCrystalsStaked).to.be.equals(1);

    // 4. Grown crystal
    const spiralId2 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    const fcrystalId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([spiralId2], 0);
    await spiralbits.approve(crystal.address, Eth2B);
    await crystal.grow(fcrystalId, 70);
    await stakingv2.stakeNFTsForOwner([fcrystalId + 4000000], signer.address);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [
      rwID.add(1000000),
      spiralId.add(2000000),
      BigNumber.from(gcrystalId + 3000000),
      BigNumber.from(fcrystalId + 4000000),
    ].forEach((cid) => {
      expect(
        walletOfOwner.findIndex((n) => n.eq(cid)),
        `Failed to find ${cid.toNumber()} in ${JSON.stringify(walletOfOwner.map((b) => b.toNumber()))}`
      ).to.be.gte(0);
    });
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numFullCrystalsStaked).to.be.equals(1);

    // Now, unstake each one by one.
    // 1. Random Walk
    await stakingv2.unstakeNFTs([rwID.add(1000000)], false);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [spiralId.add(2000000), BigNumber.from(gcrystalId + 3000000), BigNumber.from(fcrystalId + 4000000)].forEach(
      (cid) => {
        expect(walletOfOwner.findIndex((n) => n.eq(cid))).to.be.gte(0);
      }
    );
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numRWStaked).to.be.equals(0);

    // 2. Spiral
    await stakingv2.unstakeNFTs([spiralId.add(2000000)], false);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [BigNumber.from(gcrystalId + 3000000), BigNumber.from(fcrystalId + 4000000)].forEach((cid) => {
      expect(walletOfOwner.findIndex((n) => n.eq(cid))).to.be.gte(0);
    });
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numSpiralsStaked).to.be.equals(0);

    // 3. Growing crystal
    await stakingv2.unstakeNFTs([gcrystalId + 3000000], false);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    [BigNumber.from(fcrystalId + 4000000)].forEach((cid) => {
      expect(walletOfOwner.findIndex((n) => n.eq(cid))).to.be.gte(0);
    });
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numGrowingCrystalsStaked).to.be.equals(0);

    // 3. Full Grown crystal
    await stakingv2.unstakeNFTs([fcrystalId + 4000000], false);
    walletOfOwner = await stakingv2.walletOfOwner(signer.address);
    expect(walletOfOwner.length).to.be.equals(0);
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numFullCrystalsStaked).to.be.equals(0);
  });

  it("Staking - Win while staked", async function () {
    const { impishSpiral, stakingv2 } = await loadContracts();
    const [signer] = await ethers.getSigners();

    // Approve staking
    await impishSpiral.setApprovalForAll(stakingv2.address, true);

    // Mint random
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Stake
    await stakingv2.stakeNFTsForOwner([tokenId.add(2000000)], signer.address);

    // Now, fast forward 3 days
    await network.provider.send("evm_increaseTime", [3600 * 24 * 4]); // 4 days
    await network.provider.send("evm_mine");

    // We can claim it via the Staking contract
    await expect(await stakingv2.claimSpiralWin(tokenId)).to.changeEtherBalance(
      signer,
      ethers.utils.parseEther("0.00005025") // Only 1 winner, so this is the prize
    );

    // And then afterall winnings should work
    await impishSpiral.afterAllWinnings();
  });

  it("Creates epochs correctly", async function () {
    // Utility function to verify SpiralBits values in epochs.
    // Note that the array has deltas, not absolute values
    const expectEpochSpiralbitsToBe = async (expectedEpochsDeltas: BigNumber[], debugPrint?: boolean) => {
      let expectedSpiralbitsInEpoch = Zero;

      for (let i = 0; i < expectedEpochsDeltas.length; i++) {
        expectedSpiralbitsInEpoch = expectedSpiralbitsInEpoch.add(expectedEpochsDeltas[i]);
        const epoch = await stakingv2.epochs(i + 1);
        if (debugPrint) {
          console.log(JSON.stringify(epoch));
        }

        expect(epoch[1]).to.be.equals(expectedSpiralbitsInEpoch);
      }
    };

    const { impishSpiral, stakingv2, spiralbits } = await loadContracts();
    const [signer, signer2] = await ethers.getSigners();

    // Approve and stake spiralbits
    await spiralbits.approve(stakingv2.address, Eth2B);
    await stakingv2.stakeSpiralBits(Eth100);
    await expectEpochSpiralbitsToBe([Zero]);

    // Stake another 10, and this time the epochs should add the previous 100
    await stakingv2.stakeSpiralBits(Eth10);
    await expectEpochSpiralbitsToBe([Zero, Eth100]);

    // Stake from a second source
    await spiralbits.transfer(signer2.address, Eth100);
    await spiralbits.connect(signer2).approve(stakingv2.address, Eth2B);
    await stakingv2.connect(signer2).stakeSpiralBits(Eth10);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10]);

    // Now Staking a spiral should also add a new epoch
    await impishSpiral.setApprovalForAll(stakingv2.address, true);
    const tokenId1 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await stakingv2.stakeNFTsForOwner([tokenId1.add(2000000)], signer.address);
    expect(await impishSpiral.ownerOf(tokenId1)).to.be.equals(stakingv2.address);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10]);

    // Second signer removing their Spiralbits should return the SPIRALBITS
    await expect(() => stakingv2.connect(signer2).unstakeSpiralBits(false)).to.changeTokenBalance(
      spiralbits,
      signer2,
      Eth10
    );
    // ...but doesn't affect the Epochs until the next time
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10, Zero]);

    // The next time we add an epoch, it should reflect the removed SpiralBits
    const tokenId2 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await stakingv2.stakeNFTsForOwner([tokenId2.add(2000000)], signer.address);
    expect(await impishSpiral.ownerOf(tokenId2)).to.be.equals(stakingv2.address);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10, Zero, Eth10.mul(-1)]);

    // Unstaking the Spirals, but since the last call didn't have any spiralbits changes the epoch
    // spiralbits shouldn't change. We should receive the rewards, however
    await stakingv2.unstakeNFTs([tokenId1.add(2000000), tokenId2.add(2000000)], true);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10, Zero, Eth10.mul(-1), Zero]);
    expect(await impishSpiral.ownerOf(tokenId1)).to.be.equals(signer.address);
    expect(await impishSpiral.ownerOf(tokenId2)).to.be.equals(signer.address);
    expect((await stakingv2.stakedNFTsAndTokens(signer.address)).numSpiralsStaked).to.be.equals(0);
  });

  it("Negative Tests", async function () {
    const { impishSpiral, stakingv2, spiralbits } = await loadContracts();
    const [signer, signer2] = await ethers.getSigners();

    // Can't initialize again
    await expect(stakingv2.connect(signer2).initialize(spiralbits.address)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
    await expect(stakingv2.initialize(spiralbits.address)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );

    // Can't stake Spiralbits that we don't have
    await spiralbits.connect(signer2).approve(stakingv2.address, Eth2B);
    await expect(stakingv2.connect(signer2).stakeSpiralBits(Eth10)).to.be.revertedWith(
      "ERC20: transfer amount exceeds balance"
    );

    // Get some spiralbits to stake and now staking works
    await spiralbits.transfer(signer2.address, Eth100);
    await stakingv2.connect(signer2).stakeSpiralBits(Eth10);

    // Can't unstake spiralbits that we haven't staked
    await expect(stakingv2.unstakeSpiralBits(false)).to.be.revertedWith("NoSPIRALBITSToUnstake");
    await expect(() => stakingv2.connect(signer2).unstakeSpiralBits(false)).to.changeTokenBalance(
      spiralbits,
      signer2,
      Eth10
    );

    // Stake Spirals
    await impishSpiral.setApprovalForAll(stakingv2.address, true);
    await impishSpiral.connect(signer2).setApprovalForAll(stakingv2.address, true);
    const tokenId1 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    // Can't stake non-existent token
    await expect(stakingv2.stakeNFTsForOwner([tokenId1.add(1).add(2000000)], signer.address)).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );
    // Bad nft type
    await expect(stakingv2.stakeNFTsForOwner([tokenId1.add(5000000)], signer.address)).to.be.revertedWith(
      "InvalidNFTType"
    );
    // Other guy can't stake my token
    await expect(
      stakingv2.connect(signer2).stakeNFTsForOwner([tokenId1.add(2000000)], signer.address)
    ).to.be.revertedWith("DontOwnNFT");
    // Can't stake without the contract ID
    await expect(stakingv2.stakeNFTsForOwner([tokenId1], signer.address)).to.be.revertedWith("UseContractTokenIDs");

    // Finally, this works
    await stakingv2.stakeNFTsForOwner([tokenId1.add(2000000)], signer.address);

    // Signer2 can't unstake my tokenID
    await expect(stakingv2.connect(signer2).unstakeNFTs([tokenId1.add(2000000)], false)).to.be.revertedWith(
      "DontOwnNFT"
    );

    // Can't unstake without using contractID
    await expect(stakingv2.unstakeNFTs([tokenId1], false)).to.be.revertedWith("UseContractTokenIDs");

    // Stake for a different owner
    const tokenId2 = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await stakingv2.stakeNFTsForOwner([tokenId2.add(2000000)], signer2.address);

    // We can't unstake it...
    await expect(stakingv2.unstakeNFTs([tokenId2.add(2000000)], false)).to.be.revertedWith("DontOwnNFT");
    // ... but the signer2 can
    await stakingv2.connect(signer2).unstakeNFTs([tokenId2.add(2000000)], false);
    expect(await impishSpiral.ownerOf(tokenId2)).to.be.equals(signer2.address);
  });
});

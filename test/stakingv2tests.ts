/* eslint-disable node/no-missing-import */
import { expect } from "chai";
import { ethers, network } from "hardhat";

import type { RandomWalkNFT } from "../typechain/RandomWalkNFT";
import type { ImpishDAO } from "../typechain/ImpishDAO";
import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { SpiralBits } from "../typechain/SpiralBits";
import type { StakingV2 } from "../typechain/StakingV2";

import { BigNumber } from "ethers";

type FixtureType = {
  impishSpiral: ImpishSpiral;
  impdao: ImpishDAO;
  rwnft: RandomWalkNFT;
  spiralbits: SpiralBits;
  stakingv2: StakingV2;
};

describe.only("SpiralStaking V2", function () {
  const Zero = BigNumber.from(0);

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
    const stakingv2 = await StakingV2.deploy(crystal.address);
    await stakingv2.deployed();

    // Allow spiral staking to mint spiralbits
    spiralbits.addAllowedMinter(stakingv2.address);

    // Start the mints
    await impishSpiral.startMints();

    return { impishSpiral, impdao, rwnft, spiralbits, stakingv2 };
  }

  it("Simple Staking V2", async function () {
    const { impdao, spiralbits, stakingv2 } = await loadContracts();
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

  it.only("Creates epochs correctly", async function () {
    // Utility function to verify SpiralBits values in epochs.
    // Note that the array has deltas, not absolute values
    const expectEpochSpiralbitsToBe = async (expectedEpochsDeltas: BigNumber[], debugPrint?: boolean) => {
      let expectedSpiralbitsInEpoch = Zero;

      for (let i = 0; i < expectedEpochsDeltas.length; i++) {
        expectedSpiralbitsInEpoch = expectedSpiralbitsInEpoch.add(expectedEpochsDeltas[i]);
        const epoch = await stakingv2.epochs(i + 1);
        expect(epoch[1]).to.be.equals(expectedSpiralbitsInEpoch);

        if (debugPrint) {
          console.log(JSON.stringify(epoch));
        }
      }
    };

    const { impishSpiral, stakingv2, spiralbits } = await loadContracts();
    const [signer, signer2] = await ethers.getSigners();

    const Eth2B = ethers.utils.parseEther("2000000000");
    const Eth100 = ethers.utils.parseEther("100");
    const Eth10 = ethers.utils.parseEther("10");

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
    let tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await stakingv2.stakeNFTsForOwner([tokenId.add(2000000)], signer.address);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10]);

    // Second signer removing their Spiralbits should reduce the staked spiralbits
    await expect(() => stakingv2.connect(signer2).unstakeSpiralBits(false)).to.changeTokenBalance(
      spiralbits,
      signer2,
      Eth10
    );

    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10, Zero]);

    // The next time we add an epoch, it should reflect the removed SpiralBits
    tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });
    await stakingv2.stakeNFTsForOwner([tokenId.add(2000000)], signer.address);
    await expectEpochSpiralbitsToBe([Zero, Eth100, Eth10, Eth10, Zero, Eth10.mul(-1)]);
  });
});

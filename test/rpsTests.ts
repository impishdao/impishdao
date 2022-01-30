/* eslint-disable node/no-missing-import */

import type { ImpishSpiral } from "../typechain/ImpishSpiral";
import type { ImpishCrystal } from "../typechain";
import type { SpiralBits } from "../typechain";
import type { StakingV2 } from "../typechain/StakingV2";
import type { RPS } from "../typechain/RPS";

import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { expect } from "chai";

type FixtureType = {
    impishSpiral: ImpishSpiral;
    stakingv2: StakingV2;
    spiralbits: SpiralBits;
    crystal: ImpishCrystal;
    rps: RPS;
  };

  
describe.only("RPS", function() {
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

      const RPS = await ethers.getContractFactory("RPS");
      const rps = await RPS.deploy(stakingv2.address);
      await rps.deployed();
  
      return { impishSpiral, spiralbits, crystal, stakingv2, rps };
    }

    it("Commits And Verify", async function () {
        const { impishSpiral, stakingv2, rps } = await loadContracts();
        const [signer] = await ethers.getSigners();

        const password = "password";
        const salt = BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password))).shr(128);
        const commitment = ethers.utils.solidityKeccak256(["uint128", "uint8"], [salt, 1]);
        await rps.commit(commitment, signer.address, []);

        await rps.revealCommitment(salt, 1);
    });
});
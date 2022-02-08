/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers, network, upgrades } from "hardhat";
import path from "path";
import contractAddresses from "../proddata/contracts/contract-addresses.json";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // Uniswap addresses
  const swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const impishPoolAddress = "0xb2c699cdfbee566c53f1fbc9868a8bb828729985";
  const WETH9 = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

  // eslint-disable-next-line no-unused-vars
  const [signer, otherSigner] = await ethers.getSigners();

  // We get the contract to deploy
  const ImpishDAO = await ethers.getContractFactory("ImpishDAO");
  const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");
  const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");
  const SpiralMarket = await ethers.getContractFactory("SpiralMarket");
  const MultiMint = await ethers.getContractFactory("MultiMint");
  const SpiralBits = await ethers.getContractFactory("SpiralBits");
  const RWNFTStaking = await ethers.getContractFactory("RWNFTStaking");
  const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
  const RwnftStaking = await ethers.getContractFactory("RWNFTStaking");
  const BuyWithEther = await ethers.getContractFactory("BuyWithEther");
  const ImpishCrystal = await ethers.getContractFactory("ImpishCrystal");

  const rwnft = new ethers.Contract(contractAddresses.RandomWalkNFT, RandomWalkNFT.interface, signer);
  const impish = new ethers.Contract(contractAddresses.ImpishDAO, ImpishDAO.interface, signer);
  const spiralbits = new ethers.Contract(contractAddresses.SpiralBits, SpiralBits.interface, signer);
  const impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiral.interface, signer);
  const spiralmarket = new ethers.Contract(contractAddresses.SpiralMarket, SpiralMarket.interface, signer);
  const spiralstakign = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStaking.interface, signer);
  const rwnftstaking = new ethers.Contract(contractAddresses.RWNFTStaking, RWNFTStaking.interface, signer);
  const crystal = new ethers.Contract(contractAddresses.Crystal, ImpishCrystal.interface, signer);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x21C853369eeB2CcCbd722d313Dcf727bEfBb02f4"],
  });
  const prodSigner = await ethers.getSigner("0x21C853369eeB2CcCbd722d313Dcf727bEfBb02f4");

  const StakingV2 = await ethers.getContractFactory("StakingV2", prodSigner);
  const stakingv2 = await new ethers.Contract(contractAddresses.StakingV2, StakingV2.interface, prodSigner);

  rwnft.setApprovalForAll(rwnftstaking.address, true);
  impishspiral.setApprovalForAll(spiralstakign.address, true);

  await network.provider.send("evm_increaseTime", [3600 * 24 * 3]);
  await network.provider.send("evm_mine");

  let startSpiral = 446;
  for (let i = 0; i < 10; i++) {
    const spiralId = startSpiral - i;
    console.log(`Claiming ${spiralId}`);
    if ((await impishspiral.ownerOf(spiralId)) === stakingv2.address) {
      await stakingv2.claimSpiralWin(spiralId);
      console.log("Success Staking");
    } else {
      await impishspiral.claimWin(spiralId);
      console.log("Success Direct");
    }
  }

  console.log(ethers.utils.formatEther(await prodSigner.getBalance()));
  await impishspiral.connect(prodSigner).afterAllWinnings();
  console.log(ethers.utils.formatEther(await prodSigner.getBalance()));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

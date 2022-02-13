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
  const Eth2B = ethers.utils.parseEther("2000000000");

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
  const [signer, signer2, signer3] = await ethers.getSigners();

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
  const ImpishCrystal = await ethers.getContractFactory("ImpishCrystal");
  const StakingV2 = await ethers.getContractFactory("StakingV2");
  const BuyWithEther = await ethers.getContractFactory("BuyWithEther");

  // const rwnft = new ethers.Contract(contractAddresses.RandomWalkNFT, RandomWalkNFT.interface, signer);
  // const impish = new ethers.Contract(contractAddresses.ImpishDAO, ImpishDAO.interface, signer);
  // const spiralbits = new ethers.Contract(contractAddresses.SpiralBits, SpiralBits.interface, signer);
  // const impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiral.interface, signer);
  // const spiralmarket = new ethers.Contract(contractAddresses.SpiralMarket, SpiralMarket.interface, signer);
  // const spiralstakign = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStaking.interface, signer);
  // const rwnftstaking = new ethers.Contract(contractAddresses.RWNFTStaking, RWNFTStaking.interface, signer);
  // const crystal = new ethers.Contract(contractAddresses.Crystal, ImpishCrystal.interface, signer);
  // const stakingv2 = new ethers.Contract(contractAddresses.StakingV2, StakingV2.interface, signer);

  // await network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: ["0x21C853369eeB2CcCbd722d313Dcf727bEfBb02f4"],
  // });
  // const prodSigner = await ethers.getSigner("0x21C853369eeB2CcCbd722d313Dcf727bEfBb02f4");

  // const StakingV2 = await ethers.getContractFactory("StakingV2", prodSigner);
  // const stakingv2 = await upgrades.upgradeProxy(contractAddresses.StakingV2, StakingV2);
  // await stakingv2.deployed();

  const rwnft = await RandomWalkNFT.deploy();
  await rwnft.deployed();

  const impdao = await ImpishDAO.deploy(rwnft.address);
  await impdao.deployed();

  const impishSpiral = await ImpishSpiral.deploy(rwnft.address, impdao.address);
  await impishSpiral.deployed();

  const spiralbits = await SpiralBits.deploy();
  await spiralbits.deployed();

  const spiralstaking = await SpiralStaking.deploy(impishSpiral.address, spiralbits.address, rwnft.address);
  await spiralstaking.deployed();

  const crystal = await ImpishCrystal.deploy(impishSpiral.address, spiralstaking.address, spiralbits.address);
  await crystal.deployed();

  const stakingv2 = await StakingV2.deploy();
  await stakingv2.deployed();
  await stakingv2.initialize(crystal.address);

  const multimint = await MultiMint.deploy(impishSpiral.address);
  await multimint.deployed();

  // Allow spiral staking to mint spiralbits
  await spiralbits.addAllowedMinter(stakingv2.address);

  // Start the mints
  await impishSpiral.startMints();

  const RPS = await ethers.getContractFactory("RPS");
  const rps = await RPS.deploy(stakingv2.address);
  await rps.deployed();

  stakingv2.setRPS(rps.address);

  // Allow RPS to mint
  await spiralbits.addAllowedMinter(rps.address);
  await crystal.setApprovalForAll(stakingv2.address, true);

  // Create 6 fully grown crystals
  await spiralbits.approve(crystal.address, Eth2B);
  for (let i = 0; i < 6; i++) {
    const tokenId = await impishSpiral._tokenIdCounter();
    await impishSpiral.mintSpiralRandom({ value: await impishSpiral.getMintPrice() });

    const crystalId = await crystal._tokenIdCounter();
    await crystal.mintCrystals([tokenId], 0);

    // Max out the crystal
    await crystal.grow(crystalId, 70);

    if (i < 2) {
      if (i % 2 === 0) {
        await stakingv2.stakeNFTsForOwner([crystalId + 4000000], signer2.address);
      } else {
        await crystal["safeTransferFrom(address,address,uint256)"](signer.address, signer2.address, crystalId);
      }
    } else if (i < 5) {
      if (i % 2 === 0) {
        await stakingv2.stakeNFTsForOwner([crystalId + 4000000], signer3.address);
      } else {
        await crystal["safeTransferFrom(address,address,uint256)"](signer.address, signer3.address, crystalId);
      }
    }
  }

  // We also save the contract's artifacts and address in the frontend directory
  const newContractAddresses = Object.assign(contractAddresses, {
    RandomWalkNFT: rwnft.address,
    ImpishDAO: impdao.address,
    ImpishSpiral: impishSpiral.address,
    SpiralBits: spiralbits.address,
    Crystal: crystal.address,
    StakingV2: stakingv2.address,
    SpiralStaking: spiralstaking.address,
    MultiMint: multimint.address,
    RPS: rps.address,
  });
  saveFrontendFiles(newContractAddresses, stakingv2, rps);

  // Buy some magic for testing
  // await buywithether.buyMagicTODOTEMP({ value: ethers.utils.parseEther("1") });
  // const MAGIC = await ethers.getContractFactory("ERC20");
  // const magic = new ethers.Contract("0x539bdE0d7Dbd336b79148AA742883198BBF60342", MAGIC.interface, signer);
  // await magic.approve(buywithether.address, ethers.utils.parseEther("2000000"));

  // await buywithether.megaMintWithMagic(signer.address, 1, ethers.utils.parseEther("150"));

  // await spiralbits.connect(prodSigner).addAllowedMinter(prodSigner.address);
  // await spiralbits.connect(prodSigner).mintSpiralBits(prodSigner.address, ethers.utils.parseEther("100000000"));
  // await spiralbits.connect(prodSigner).transfer(signer.address, ethers.utils.parseEther("100000000"));

  // for (let i = 0; i < 5; i++) {
  //   const rtokenId = await rwnft.nextTokenId();
  //   await rwnft.mint({ value: await rwnft.getMintPrice() });

  //   const stokenId = await impishspiral._tokenIdCounter();
  //   await impishspiral.mintSpiralWithRWNFT(rtokenId, { value: await impishspiral.getMintPrice() });

  //   await rwnftstaking.stakeNFTsForOwner([rtokenId], signer.address);
  //   await spiralstakign.stakeNFTsForOwner([stokenId], signer.address);
  // }
}

function saveFrontendFiles(newContractAddresses: any, stakingv2: Contract, rps: Contract) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "/../frontend/src/contracts");
  const serverDir = path.join(__dirname, "/../server/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir);
  }

  const newContractAddressStr = JSON.stringify(newContractAddresses, undefined, 2);

  fs.writeFileSync(contractsDir + "/contract-addresses.json", newContractAddressStr);
  fs.writeFileSync(serverDir + "/contract-addresses.json", newContractAddressStr);

  const RPSArtifact = artifacts.readArtifactSync("RPS");
  fs.writeFileSync(contractsDir + "/rps.json", JSON.stringify(RPSArtifact, null, 2));
  fs.writeFileSync(serverDir + "/rps.json", JSON.stringify(RPSArtifact, null, 2));

  const StakingV2Artifact = artifacts.readArtifactSync("StakingV2");
  fs.writeFileSync(contractsDir + "/stakingv2.json", JSON.stringify(StakingV2Artifact, null, 2));
  fs.writeFileSync(serverDir + "/stakingv2.json", JSON.stringify(StakingV2Artifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

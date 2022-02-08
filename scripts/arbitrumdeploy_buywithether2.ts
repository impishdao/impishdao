/* eslint-disable camelcase */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers, upgrades } from "hardhat";
import path from "path";
import contractAddresses from "../proddata/contracts/contract-addresses.json";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deploying from ${signer.address}`);

  // First, upgrade StakingV2
  const StakingV2 = await ethers.getContractFactory("StakingV2", signer);
  const stakingv2 = await upgrades.upgradeProxy(contractAddresses.StakingV2, StakingV2);
  await stakingv2.deployed();

  // We get the contract to deploy
  const swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const BuyWithEther = await ethers.getContractFactory("BuyWithEther");
  const buywithether = await BuyWithEther.deploy(swapRouter);
  await buywithether.deployed();

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(stakingv2, buywithether);

  console.log("BuyWithEther deployed to:", buywithether.address);
  console.log("StakingV2 upgraded to:", stakingv2.address);
}

function saveFrontendFiles(stakingv2: Contract, buywithether: Contract) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "/../frontend/src/contracts");
  const serverDir = path.join(__dirname, "/../server/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir);
  }

  const newContractAddressStr = JSON.stringify(
    Object.assign(contractAddresses, {
      StakingV2: stakingv2.address,
      BuyWithEther: buywithether.address,
    }),
    undefined,
    2
  );

  fs.writeFileSync(contractsDir + "/contract-addresses.json", newContractAddressStr);
  fs.writeFileSync(serverDir + "/contract-addresses.json", newContractAddressStr);

  const StakingV2Artifact = artifacts.readArtifactSync("StakingV2");
  fs.writeFileSync(contractsDir + "/stakingv2.json", JSON.stringify(StakingV2Artifact, null, 2));
  fs.writeFileSync(serverDir + "/stakingv2.json", JSON.stringify(StakingV2Artifact, null, 2));

  const buywithEtherArtifact = artifacts.readArtifactSync("BuyWithEther");
  fs.writeFileSync(contractsDir + "/buywithether.json", JSON.stringify(buywithEtherArtifact, null, 2));
  fs.writeFileSync(serverDir + "/buywithether.json", JSON.stringify(buywithEtherArtifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

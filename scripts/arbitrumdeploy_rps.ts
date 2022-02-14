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

  const StakingV2 = await ethers.getContractFactory("StakingV2");
  const stakingv2 = new ethers.Contract(contractAddresses.StakingV2, StakingV2.interface, signer);

  // We get the contract to deploy
  const RPS = await ethers.getContractFactory("RPS");
  const rps = await upgrades.deployProxy(RPS, [contractAddresses.StakingV2]);
  await rps.deployed();

  // Add RPS to Staking V2
  await stakingv2.setRPS(rps.address);

  const SpiralMarket = await ethers.getContractFactory("SpiralMarket");
  const spiralmarket = new ethers.Contract(contractAddresses.SpiralMarket, SpiralMarket.interface, signer);

  await spiralmarket.pauseContract();

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(rps);

  console.log("RPS deployed to:", stakingv2.address);
}

function saveFrontendFiles(rps: Contract) {
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
      RPS: rps.address,
    }),
    undefined,
    2
  );

  fs.writeFileSync(contractsDir + "/contract-addresses.json", newContractAddressStr);
  fs.writeFileSync(serverDir + "/contract-addresses.json", newContractAddressStr);

  const RPSArtifact = artifacts.readArtifactSync("RPS");
  fs.writeFileSync(contractsDir + "/rps.json", JSON.stringify(RPSArtifact, null, 2));
  fs.writeFileSync(serverDir + "/rps.json", JSON.stringify(RPSArtifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

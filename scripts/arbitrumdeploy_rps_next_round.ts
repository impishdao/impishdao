/* eslint-disable camelcase */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import contractAddresses from "../proddata/contracts/contract-addresses.json";

import { artifacts, ethers } from "hardhat";
import path from "path";
import { RPS, SpiralBits } from "../typechain";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deploying from ${signer.address}`);

  const RPSF = await ethers.getContractFactory("RPS");
  const rps = new ethers.Contract(contractAddresses.RPS, RPSF.interface, signer) as RPS;

  const SpiralBitsF = await ethers.getContractFactory("SpiralBits");
  const spiralbits = new ethers.Contract(contractAddresses.SpiralBits, SpiralBitsF.interface, signer) as SpiralBits

  // Add as allowed minter
  // await spiralbits.addAllowedMinter(rps.address);

  // Resolve
  await rps.resolve();

  // Reset for next round, which pays out the bounties
  await rps.resetForNextRound(false);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

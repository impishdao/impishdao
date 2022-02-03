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
  const [signer, otherSigner] = await ethers.getSigners();

  const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");
  const impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiral.interface, signer);

  // await impishspiral.setBaseURI("https://impishdao.com/spiralapi/spirals/metadata/");
  console.log(await impishspiral.tokenURI(100));

  const ImpishCrystal = await ethers.getContractFactory("ImpishCrystal");
  const crystal = new ethers.Contract(contractAddresses.Crystal, ImpishCrystal.interface, signer);
  console.log(await crystal.tokenURI(100));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

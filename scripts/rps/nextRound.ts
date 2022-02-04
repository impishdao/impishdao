// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import type { RPS } from "../../typechain/RPS";
import { artifacts, ethers, network, upgrades } from "hardhat";
import contractAddresses from "../../frontend/src/contracts/contract-addresses.json";

async function main() {
  // eslint-disable-next-line no-unused-vars
  const [signer, otherSigner] = await ethers.getSigners();

  const RPSArtifact = await ethers.getContractFactory("RPS");
  const rps = new ethers.Contract(contractAddresses.RPS, RPSArtifact.interface, signer) as RPS

  await rps.resetForNextRound(false);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

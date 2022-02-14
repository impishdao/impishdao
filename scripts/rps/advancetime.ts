// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import type { ImpishSpiral } from "../../typechain/ImpishSpiral";
import type { RPS } from "../../typechain/RPS";
import { artifacts, ethers, network, upgrades } from "hardhat";
import contractAddresses from "../../server/src/contracts/contract-addresses.json";

async function main() {
  // eslint-disable-next-line no-unused-vars
  const [signer, otherSigner] = await ethers.getSigners();

  const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");
  const impishspiral = new ethers.Contract(
    contractAddresses.ImpishSpiral,
    ImpishSpiral.interface,
    signer
  ) as ImpishSpiral;

  // await network.provider.send("evm_increaseTime", [3600 * 24 * 1]);
  // await network.provider.send("evm_mine");

  // await impishspiral.mintSpiralRandom({ value: await impishspiral.getMintPrice() });

  // await network.provider.send("evm_increaseTime", [3600 * 24 * 2]);
  // await network.provider.send("evm_mine");

  // await impishspiral.mintSpiralRandom({ value: await impishspiral.getMintPrice() });

  const RPSArtifact = await ethers.getContractFactory("RPS");
  const rps = new ethers.Contract(contractAddresses.RPS, RPSArtifact.interface, signer) as RPS;
  await rps.resolve();
  // await rps.resetForNextRound(false);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

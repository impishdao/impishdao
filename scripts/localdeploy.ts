// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers } from "hardhat";
import path from "path";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const ImpishDAO = await ethers.getContractFactory("ImpishDAO");
  const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");
  const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");

  const rwnft = await RandomWalkNFT.deploy();
  await rwnft.deployed();

  const impdao = await ImpishDAO.deploy(rwnft.address);
  await impdao.deployed();

  const impishspiral = await ImpishSpiral.deploy(rwnft.address, impdao.address);
  await impishspiral.deployed();

  // Mint a new NFT to reset the last mint time
  await rwnft.mint({ value: await rwnft.getMintPrice() });

  console.log("RandomWalkNFT deployed to:", rwnft.address);
  console.log("ImpishDAO deployed to:", impdao.address);
  console.log("ImpishSpiral deployed to:", impishspiral.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(rwnft, impdao, impishspiral);
}

function saveFrontendFiles(rwnft: Contract, impdao: Contract, impishspiral: Contract) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "/../frontend/src/contracts");
  const serverDir = path.join(__dirname, "/../server/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-addresses.json",
    JSON.stringify(
      { RandomWalkNFT: rwnft.address, ImpishDAO: impdao.address, ImpishSpiral: impishspiral },
      undefined,
      2
    )
  );
  fs.writeFileSync(
    serverDir + "/contract-addresses.json",
    JSON.stringify({ RandomWalkNFT: rwnft.address, ImpishDAO: impdao.address }, undefined, 2)
  );

  const rwnftArtifact = artifacts.readArtifactSync("RandomWalkNFT");
  fs.writeFileSync(contractsDir + "/rwnft.json", JSON.stringify(rwnftArtifact, null, 2));
  fs.writeFileSync(serverDir + "/rwnft.json", JSON.stringify(rwnftArtifact, null, 2));

  const wrwArtifact = artifacts.readArtifactSync("ImpishDAO");
  fs.writeFileSync(contractsDir + "/impdao.json", JSON.stringify(wrwArtifact, null, 2));
  fs.writeFileSync(serverDir + "/impdao.json", JSON.stringify(wrwArtifact, null, 2));

  const impSpiralArtifact = artifacts.readArtifactSync("ImpishSpiral");
  fs.writeFileSync(contractsDir + "/impishspiral.json", JSON.stringify(impSpiralArtifact, null, 2));
  fs.writeFileSync(serverDir + "/impishspiral.json", JSON.stringify(impSpiralArtifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

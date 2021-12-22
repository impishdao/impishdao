/* eslint-disable camelcase */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers } from "hardhat";
import path from "path";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deploying from ${signer.address}`);

  // We get the contract to deploy
  const SpiralMarket = await ethers.getContractFactory("SpiralMarket");

  // Verified contract on Arbitrum
  // https://arbiscan.io/address/0x895a6F444BE4ba9d124F61DF736605792B35D66b#code
  const RandomWalkNFT_address = "0x895a6F444BE4ba9d124F61DF736605792B35D66b";

  // Verified contract on Arbitrum
  // https://arbiscan.io/address/0x36f6d831210109719d15abaee45b327e9b43d6c6
  const IMPISHDAO_address = "0x36f6d831210109719d15abaee45b327e9b43d6c6";

  // Verified contract on Arbitrum
  // https://arbiscan.io/address/0xB6945B73ed554DF8D52ecDf1Ab08F17564386e0f
  const IMPISHSPIRALS_address = "0xB6945B73ed554DF8D52ecDf1Ab08F17564386e0f";

  const spiralmarket = await SpiralMarket.deploy(IMPISHSPIRALS_address);
  await spiralmarket.deployed();

  console.log("Spiral Marketplace deployed to:", spiralmarket.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(RandomWalkNFT_address, IMPISHDAO_address, IMPISHSPIRALS_address, spiralmarket);
}

function saveFrontendFiles(rwnft: string, impdao: string, impishspiral: string, spiralmarket: Contract) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "/../frontend/src/contracts");
  const serverDir = path.join(__dirname, "/../server/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir);
  }

  const contractAddress = JSON.stringify(
    { RandomWalkNFT: rwnft, ImpishDAO: impdao, ImpishSpiral: impishspiral, SpiralMarket: spiralmarket.address },
    undefined,
    2
  );

  fs.writeFileSync(contractsDir + "/contract-addresses.json", contractAddress);
  fs.writeFileSync(serverDir + "/contract-addresses.json", contractAddress);

  const rwnftArtifact = artifacts.readArtifactSync("RandomWalkNFT");
  fs.writeFileSync(contractsDir + "/rwnft.json", JSON.stringify(rwnftArtifact, null, 2));
  fs.writeFileSync(serverDir + "/rwnft.json", JSON.stringify(rwnftArtifact, null, 2));

  const wrwArtifact = artifacts.readArtifactSync("ImpishDAO");
  fs.writeFileSync(contractsDir + "/impdao.json", JSON.stringify(wrwArtifact, null, 2));
  fs.writeFileSync(serverDir + "/impdao.json", JSON.stringify(wrwArtifact, null, 2));

  const impSpiralArtifact = artifacts.readArtifactSync("ImpishSpiral");
  fs.writeFileSync(contractsDir + "/impishspiral.json", JSON.stringify(impSpiralArtifact, null, 2));
  fs.writeFileSync(serverDir + "/impishspiral.json", JSON.stringify(impSpiralArtifact, null, 2));

  const spiralmarketArtifact = artifacts.readArtifactSync("SpiralMarket");
  fs.writeFileSync(contractsDir + "/spiralmarket.json", JSON.stringify(spiralmarketArtifact, null, 2));
  fs.writeFileSync(serverDir + "/spiralmarket.json", JSON.stringify(spiralmarketArtifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Deploying from ${signer.address}`);

  // We get the contract to deploy
  const ImpishDAO = await ethers.getContractFactory("ImpishDAO");

  // Verified contract on Arbitrum
  // https://arbiscan.io/address/0x895a6F444BE4ba9d124F61DF736605792B35D66b#code
  const RandomWalkNFT_address = "0x895a6F444BE4ba9d124F61DF736605792B35D66b";

  const impdao = await ImpishDAO.deploy(RandomWalkNFT_address);
  await impdao.deployed();

  console.log("ImpishDAO deployed to:", impdao.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(RandomWalkNFT_address, impdao);
}

function saveFrontendFiles(rwnft: string, impdao: Contract) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";
  const serverDir = __dirname + "/../server/src/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir);
  }

  fs.writeFileSync(
    contractsDir + "/contract-addresses.json",
    JSON.stringify(
      { RandomWalkNFT: rwnft, ImpishDAO: impdao.address },
      undefined,
      2
    )
  );
  fs.writeFileSync(
    serverDir + "/contract-addresses.json",
    JSON.stringify(
      { RandomWalkNFT: rwnft, ImpishDAO: impdao.address },
      undefined,
      2
    )
  );

  const rwnftArtifact = artifacts.readArtifactSync("RandomWalkNFT");
  fs.writeFileSync(
    contractsDir + "/rwnft.json",
    JSON.stringify(rwnftArtifact, null, 2)
  );
  fs.writeFileSync(
    serverDir + "/rwnft.json",
    JSON.stringify(rwnftArtifact, null, 2)
  );

  const wrwArtifact = artifacts.readArtifactSync("ImpishDAO");
  fs.writeFileSync(
    contractsDir + "/impdao.json",
    JSON.stringify(wrwArtifact, null, 2)
  );
  fs.writeFileSync(
    serverDir + "/impdao.json",
    JSON.stringify(wrwArtifact, null, 2)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

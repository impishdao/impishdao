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
  const SpiralBits = await ethers.getContractFactory("SpiralBits");
  const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
  const RwnftStaking = await ethers.getContractFactory("RWNFTStaking");

  // Verified contract on Arbitrum
  const RandomWalkNFT_address = "0x895a6F444BE4ba9d124F61DF736605792B35D66b";
  const IMPISHDAO_address = "0x36f6d831210109719d15abaee45b327e9b43d6c6";
  const IMPISHSPIRALS_address = "0xB6945B73ed554DF8D52ecDf1Ab08F17564386e0f";
  const SPIRALMARKET_address = "0x75ae378320e1cde25a496dfa22972d253fc2270f";
  const MULTIMINT_address = "0x25E781386D2A076699D82C8a8b211f6E391278c6";

  const spiralbits = await SpiralBits.deploy();
  await spiralbits.deployed();

  const spiralstaking = await SpiralStaking.deploy(IMPISHSPIRALS_address, spiralbits.address, RandomWalkNFT_address);
  await spiralstaking.deployed();

  const rwnftstaking = await RwnftStaking.deploy(IMPISHSPIRALS_address, spiralbits.address, RandomWalkNFT_address);
  await rwnftstaking.deployed();

  await spiralstaking.setRwNFTStakingContract(rwnftstaking.address);
  await rwnftstaking.setSpiralStakingContract(spiralstaking.address);

  // Allow spiral staking to mint spiralbits
  await spiralbits.addAllowedMinter(spiralstaking.address);
  await spiralbits.addAllowedMinter(rwnftstaking.address);

  console.log("SpiralBits deployed to:", spiralbits.address);
  console.log("SpiralStaking deployed to:", spiralstaking.address);
  console.log("RWNFTStaking deployed to:", rwnftstaking.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(
    RandomWalkNFT_address,
    IMPISHDAO_address,
    IMPISHSPIRALS_address,
    SPIRALMARKET_address,
    MULTIMINT_address,
    spiralbits,
    spiralstaking,
    rwnftstaking
  );
}

function saveFrontendFiles(
  rwnft: string,
  impdao: string,
  impishspiral: string,
  spiralmarket: string,
  multimint: string,
  spiralbits: Contract,
  spiralstaking: Contract,
  rwnftstaking: Contract
) {
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
    {
      RandomWalkNFT: rwnft,
      ImpishDAO: impdao,
      ImpishSpiral: impishspiral,
      SpiralMarket: spiralmarket,
      MultiMint: multimint,
      SpiralBits: spiralbits.address,
      SpiralStaking: spiralstaking.address,
      RWNFTStaking: rwnftstaking.address,
    },
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

  const multiMintArtifact = artifacts.readArtifactSync("MultiMint");
  fs.writeFileSync(contractsDir + "/multimint.json", JSON.stringify(multiMintArtifact, null, 2));
  fs.writeFileSync(serverDir + "/multimint.json", JSON.stringify(multiMintArtifact, null, 2));

  const spiralBitsArtifact = artifacts.readArtifactSync("SpiralBits");
  fs.writeFileSync(contractsDir + "/spiralbits.json", JSON.stringify(spiralBitsArtifact, null, 2));
  fs.writeFileSync(serverDir + "/spiralbits.json", JSON.stringify(spiralBitsArtifact, null, 2));

  const spiralStakingArtifact = artifacts.readArtifactSync("SpiralStaking");
  fs.writeFileSync(contractsDir + "/spiralstaking.json", JSON.stringify(spiralStakingArtifact, null, 2));
  fs.writeFileSync(serverDir + "/spiralstaking.json", JSON.stringify(spiralStakingArtifact, null, 2));

  const rwnftStakingArtifact = artifacts.readArtifactSync("RWNFTStaking");
  fs.writeFileSync(contractsDir + "/rwnftstaking.json", JSON.stringify(rwnftStakingArtifact, null, 2));
  fs.writeFileSync(serverDir + "/rwnftstaking.json", JSON.stringify(rwnftStakingArtifact, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

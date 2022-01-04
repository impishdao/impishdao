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
  const SpiralMarket = await ethers.getContractFactory("SpiralMarket");
  const MultiMint = await ethers.getContractFactory("MultiMint");
  const SpiralBits = await ethers.getContractFactory("SpiralBits");
  const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
  const RwnftStaking = await ethers.getContractFactory("RWNFTStaking");

  const rwnft = await RandomWalkNFT.deploy();
  await rwnft.deployed();

  const impdao = await ImpishDAO.deploy(rwnft.address);
  await impdao.deployed();

  const impishspiral = await ImpishSpiral.deploy(rwnft.address, impdao.address);
  await impishspiral.deployed();

  const spiralmarket = await SpiralMarket.deploy(impishspiral.address);
  await spiralmarket.deployed();

  const multimint = await MultiMint.deploy(impishspiral.address);
  await multimint.deployed();

  const spiralbits = await SpiralBits.deploy();
  await spiralbits.deployed();

  const spiralstaking = await SpiralStaking.deploy(impishspiral.address, spiralbits.address, rwnft.address);
  await spiralstaking.deployed();

  const rwnftstaking = await RwnftStaking.deploy(impishspiral.address, spiralbits.address, rwnft.address);
  await rwnftstaking.deployed();

  await spiralstaking.setRwNFTStakingContract(rwnftstaking.address);
  await rwnftstaking.setSpiralStakingContract(spiralstaking.address);

  // Allow spiral staking to mint spiralbits
  await spiralbits.addAllowedMinter(spiralstaking.address);
  await spiralbits.addAllowedMinter(rwnftstaking.address);

  // Mint a new NFT to reset the last mint time
  await rwnft.mint({ value: await rwnft.getMintPrice() });

  console.log("RandomWalkNFT deployed to:", rwnft.address);
  console.log("ImpishDAO deployed to:", impdao.address);
  console.log("ImpishSpiral deployed to:", impishspiral.address);
  console.log("SpiralMarket deployed to:", spiralmarket.address);
  console.log("MultiMint deployed to:", multimint.address);
  console.log("SpiralBits deployed to:", spiralbits.address);
  console.log("SpiralStaking deployed to:", spiralstaking.address);
  console.log("RWNFTStaking deployed to:", rwnftstaking.address);

  // Start the ImpishSpiral for ease
  await impishspiral.startMints();

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(rwnft, impdao, impishspiral, spiralmarket, multimint, spiralbits, spiralstaking, rwnftstaking);

  // eslint-disable-next-line no-unused-vars
  const [signer, otherSigner] = await ethers.getSigners();

  setTimeout(async () => {
    // Approve the market for listing
    // await impishspiral.setApprovalForAll(spiralmarket.address, true);
    await rwnft.mint({ value: await rwnft.getMintPrice() });

    // Mint 5 spirals
    for (let i = 0; i < 5; i++) {
      const mintPrice = await impishspiral.getMintPrice();
      const tx = await impishspiral.mintSpiralRandom({ value: mintPrice });
      await tx.wait();
    }

    await impishspiral.connect(otherSigner).setApprovalForAll(spiralmarket.address, true);
    for (let i = 0; i < 5; i++) {
      const tokenId = await impishspiral._tokenIdCounter();
      const tx2 = await impishspiral
        .connect(otherSigner)
        .mintSpiralRandom({ value: await impishspiral.getMintPrice() });
      await tx2.wait();

      // And list it for sale
      spiralmarket.connect(otherSigner).listSpiral(tokenId, ethers.utils.parseEther("0.005"));
    }
  }, 10 * 1000);
}

function saveFrontendFiles(
  rwnft: Contract,
  impdao: Contract,
  impishspiral: Contract,
  spiralmarket: Contract,
  multimint: Contract,
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
      RandomWalkNFT: rwnft.address,
      ImpishDAO: impdao.address,
      ImpishSpiral: impishspiral.address,
      SpiralMarket: spiralmarket.address,
      MultiMint: multimint.address,
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

  const spiralMarketArtifact = artifacts.readArtifactSync("SpiralMarket");
  fs.writeFileSync(contractsDir + "/spiralmarket.json", JSON.stringify(spiralMarketArtifact, null, 2));
  fs.writeFileSync(serverDir + "/spiralmarket.json", JSON.stringify(spiralMarketArtifact, null, 2));

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

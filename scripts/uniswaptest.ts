// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { Contract } from "@ethersproject/contracts";
import { artifacts, ethers, network } from "hardhat";
import { Pool } from "@uniswap/v3-sdk";
import { Address } from "cluster";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import { BigNumber } from "ethers";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const swapRouter = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const poolAddress = "0xb2c699cdfbee566c53f1fbc9868a8bb828729985";
  const WETH9 = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

  // eslint-disable-next-line no-unused-vars
  const [signer, otherSigner] = await ethers.getSigners();

  // We get the contract to deploy
  const ImpishDAO = await ethers.getContractFactory("ImpishDAO");
  const RandomWalkNFT = await ethers.getContractFactory("RandomWalkNFT");
  const ImpishSpiral = await ethers.getContractFactory("ImpishSpiral");
  const SpiralMarket = await ethers.getContractFactory("SpiralMarket");
  const MultiMint = await ethers.getContractFactory("MultiMint");
  const SpiralBits = await ethers.getContractFactory("SpiralBits");
  const SpiralStaking = await ethers.getContractFactory("SpiralStaking");
  const RwnftStaking = await ethers.getContractFactory("RWNFTStaking");

  console.log("Starting");
  const BuyWithEther = await ethers.getContractFactory("BuyWithEther");
  const buywithether = await BuyWithEther.deploy(swapRouter);
  await buywithether.deployed();
  console.log(`Deployed at ${buywithether.address}`);

  const RandomWalkNFT_address = "0x895a6F444BE4ba9d124F61DF736605792B35D66b";
  const IMPISHDAO_address = "0x36f6d831210109719d15abaee45b327e9b43d6c6";
  const IMPISHSPIRALS_address = "0xB6945B73ed554DF8D52ecDf1Ab08F17564386e0f";
  const SPIRALMARKET_address = "0x75ae378320e1cde25a496dfa22972d253fc2270f";
  const MULTIMINT_address = "0x25E781386D2A076699D82C8a8b211f6E391278c6";
  const SpiralBits_address = "0x650A9960673688Ba924615a2D28c39A8E015fB19";
  const SpiralStaking_address = "0xFa798e448dB7987A5D7ab3620D7C3d5ECb18275E";
  const RWNFTStaking_address = "0xD9403e7497051b317cf1aE88eEaf46ee4E8eAD68";

  const impish = new ethers.Contract(IMPISHDAO_address, ImpishDAO.interface, signer);

  // console.log(`Before ETH: ${await signer.getBalance(signer.address)}`);
  console.log(`Before ETH: ${ethers.utils.formatEther(await ethers.provider.getBalance(signer.address))}`);
  console.log(`Before IMPISH: ${ethers.utils.formatEther(await impish.balanceOf(signer.address))}`);

  const tx = await buywithether.buyRwNFTFromDaoWithEth(3548, {value: ethers.utils.parseEther("1")});
  await tx.wait();

  console.log(`AFTER ETH: ${ethers.utils.formatEther(await ethers.provider.getBalance(signer.address))}`);
  console.log(`AFTER IMPISH: ${ethers.utils.formatEther(await impish.balanceOf(signer.address))}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

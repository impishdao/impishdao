/* eslint-disable node/no-unpublished-import */
import { BigNumber, ethers } from "ethers";
import express from "express";

import Crystal from "./contracts/crystal.json";
import SpiralStakingArtifact from "./contracts/spiralstaking.json";
import ImpishSpiralArtifact from "./contracts/impishspiral.json";
import contractAddresses from "./contracts/contract-addresses.json";

export function setupCrystals(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _crystal = new ethers.Contract(contractAddresses.Crystal, Crystal.abi, provider);
  const _impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiralArtifact.abi, provider);
  const _spiralstaking = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStakingArtifact.abi, provider);

  // Return a list of all mintable crystals for all the Spirals owned or staked by this address
  app.get("/crystalapi/getmintable/:address", async (req, res) => {
    let address = "";
    try {
      address = ethers.utils.getAddress(req.params.address);
    } catch (e) {
      console.log(e);
      res.send({});
      return;
    }

    // Get a list of all Spirals owned or staked by this address.
    const [ownedSpirals, stakedSpirals] = await Promise.all([
      _impishspiral.walletOfOwner(address),
      _spiralstaking.walletOfOwner(address),
    ]);

    console.log(`Wallet is ${ownedSpirals.concat(stakedSpirals)}`);

    // For each owner or staked Spiral, get a list of all generated.
    const r = await Promise.all(
      ownedSpirals.concat(stakedSpirals).map(async (spiralId: BigNumber) => {
        const mintedBitField = BigNumber.from(await _crystal.mintedSpiralsForSpiral(spiralId)).toNumber();

        // Extract the bit fields
        const minted = [];
        for (let i = 0; i < 5; i++) {
          const bit = (mintedBitField >> i) & 1;
          console.log(`Bit ${i} is ${bit}`);
          minted.push(bit);
        }
        minted.reverse();

        return { spiralId, minted };
      })
    );

    res.send(r);
  });

  type CrystalInfo = {
    size: number;
    generation: number;
    sym: number;
    seed: number;
    spiralBitsStored: BigNumber;
    owner: string;
  };
  app.get("/crystalapi/crystal/metadata/:id", async (req, res) => {
    try {
      const id = BigNumber.from(req.params.id);
      const crystalInfo: CrystalInfo = await _crystal.crystals(id);
      const owner = await _crystal.ownerOf(id);

      const r = {
        image: ``,
        description: "ImpishDAO Crystals",
        attributes: {
          size: crystalInfo.size,
          generation: crystalInfo.generation,
          sym: crystalInfo.sym,
          seed: BigNumber.from(crystalInfo.seed),
          spiralBitsStored: crystalInfo.spiralBitsStored,
          owner,
        },
      };

      res.contentType("application/json");
      res.send(JSON.stringify(r));
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong generating metadata");
    }
  });
}

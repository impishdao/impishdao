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
        console.log(`Minted Bits for ${spiralId.toNumber()} is ${mintedBitField}`);

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

    console.log(r);
    res.send(r);
  });
}

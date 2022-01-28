/* eslint-disable node/no-unpublished-import */
import { BigNumber, ethers } from "ethers";
import express from "express";

import contractAddresses from "./contracts/contract-addresses.json";
import StakingV2Artifact from "./contracts/stakingv2.json";

export function setupStakingV2(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _v2staking = new ethers.Contract(contractAddresses.StakingV2, StakingV2Artifact.abi, provider);

  // V2 staked spirals. Note that this returns ContractTokenIDs
  app.get("/stakingv2api/wallet/:address", async (req, res) => {
    const address = req.params.address;
    try {
      const wallet = (await _v2staking.walletOfOwner(address)) as Array<BigNumber>;
      res.send(wallet);
    } catch (err) {
      res.status(500).send("Something went wrong fetch address NFTs");
    }
  });
}

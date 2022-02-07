/* eslint-disable node/no-unpublished-import */
import { BigNumber, ethers } from "ethers";
import express from "express";

import Crystal from "./contracts/crystal.json";
import RPSArtifact from "./contracts/rps.json";
import { RPS } from "../../typechain/RPS";
import contractAddresses from "./contracts/contract-addresses.json";

export function setupRPS(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _rps = new ethers.Contract(contractAddresses.RPS, RPSArtifact.abi, provider) as RPS;
  
  app.get("/rpsapi/teamstats", async (req, res) => {
    const teamStats = [];

    for (let i = 0; i < 3; i++) {
      const teamStat = await _rps.teams(i);

      teamStats.push(teamStat);
    }

    res.send(teamStats);
  });
}


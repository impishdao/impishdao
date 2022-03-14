/* eslint-disable node/no-unpublished-import */
import { BigNumber, ethers } from "ethers";
import { fork } from "child_process";
import express from "express";
import fs from "fs";
import path from "path";

import SpiralStakingArtifact from "./contracts/spiralstaking.json";
import ImpishSpiralArtifact from "./contracts/impishspiral.json";
import StakingV2Artifact from "./contracts/stakingv2.json";

import contractAddresses from "./contracts/contract-addresses.json";

export function setupSpirals(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiralArtifact.abi, provider);
  const _spiralstaking = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStakingArtifact.abi, provider);
  const _v2staking = new ethers.Contract(contractAddresses.StakingV2, StakingV2Artifact.abi, provider);

  app.get("/spiralapi/spiraldata", async (req, res) => {
    try {
      const [lastMintTime, nextTokenId, totalReward] = await Promise.all([
        _impishspiral.lastMintTime(),
        _impishspiral._tokenIdCounter(),
        _impishspiral.totalReward(),
      ]);

      res.contentType("application/json");
      res.send(JSON.stringify({ lastMintTime, nextTokenId, totalReward }));
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong generating metadata");
    }
  });

  // V1 staked spirals
  app.get("/spiralapi/stakedwallet/:address", async (req, res) => {
    const address = req.params.address;

    try {
      const wallet = (await _spiralstaking.walletOfOwner(address)) as Array<BigNumber>;
      res.send(wallet);
    } catch (err) {
      res.status(500).send("Something went wrong fetch address NFTs");
    }
  });

  app.get("/spiralapi/wallet/:address", async (req, res) => {
    const address = req.params.address;

    try {
      const wallet = (await _impishspiral.walletOfOwner(address)) as Array<BigNumber>;
      res.send(wallet);
    } catch (err) {
      res.status(500).send("Something went wrong fetch address NFTs");
    }
  });

  app.get("/spiralapi/spirals/metadata/:id", async (req, res) => {
    try {
      const id = BigNumber.from(req.params.id);
      const seed = await _impishspiral.spiralSeeds(id);
      if (BigNumber.from(seed).eq(0)) {
        res.status(404).send("Not Found");
        return;
      }

      const r = {
        image: `https://impishdao.com/spiral_image/seed/${seed}/300.png`,
        description: "ImpishDAO Spirals",
        attributes: [{ seed }],
      };

      res.contentType("application/json");
      res.set("Cache-control", `public, max-age=14400`);
      res.send(JSON.stringify(r));
    } catch (err) {
      res.status(500).send("Something went wrong generating metadata");
    }
  });

  app.get("/spiralapi/seedforid/:id", async (req, res) => {
    try {
      const id = BigNumber.from(req.params.id);

      const seed = await _impishspiral.spiralSeeds(id);
      if (BigNumber.from(seed).eq(0)) {
        res.status(404).send("Not Found");
        return;
      }

      const owner = await _impishspiral.ownerOf(id);

      let indirectOwner;
      if (owner === contractAddresses.SpiralStaking) {
        // Get the indirect owner
        indirectOwner = (await _spiralstaking.stakedTokenOwners(id)).owner;
      } else if (owner === contractAddresses.StakingV2) {
        // Get the indirect owner
        indirectOwner = (await _v2staking.stakedTokenOwners(id.add(2000000))).owner;
      }

      res.set("Cache-control", `public, max-age=14400`);
      res.send({ id, seed, owner, indirectOwner });
    } catch (err) {
      console.log(err);
      res.send({});
    }
  });

  app.get("/spiral_image/id/:id", async (req, res) => {
    const id = BigNumber.from(req.params.id);

    try {
      const seed = await _impishspiral.spiralSeeds(id);
      if (BigNumber.from(seed).eq(0)) {
        res.status(404).send("Not Found");
        return;
      }

      res.redirect(`/spiral_image/seed/${seed}.png`);
    } catch (err) {
      res.status(500).send("Something went wrong");
    }
  });

  app.get("/spiral_image/seed/:seed/:size.png", async (req, res) => {
    const seed = req.params.seed;
    try {
      // eslint-disable-next-line no-unused-vars
      const num = BigNumber.from(seed);
    } catch (e) {
      // If this errored, the seed is bad.
      res.status(404).send("Bad Seed");
      return;
    }

    if (seed.length !== 66 || seed.slice(0, 2) !== "0x") {
      res.status(404).send("Bad Seed Hex");
      return;
    }

    const size = parseInt(req.params.size);
    if (isNaN(size)) {
      res.status(404).send("Bad Size");
      return;
    }

    const fileName = `data/${seed}x${size}.png`;

    // See if the file already exists
    if (fs.existsSync(path.join(__dirname, fileName))) {
      res.sendFile(path.join(__dirname, fileName));
      return;
    }

    try {
      // const worker = new Worker("./dist/serverSpiralRenderer.js", {workerData: {seed, size}});
      const child = fork("./dist/serverSpiralRenderer.js");
      child.send({ seed, size });

      child.once("message", (r) => {
        // console.log("Message received from child");
        // console.log(r);

        const pngBuf = Buffer.from(r as Buffer);
        res.contentType("png");
        res.send(pngBuf);

        setTimeout(() => {
          if (!fs.existsSync(path.join(__dirname, "data"))) {
            fs.mkdirSync(path.join(__dirname, "data"));
          }

          fs.writeFileSync(path.join(__dirname, fileName), pngBuf);
        });
      });

      child.on("error", (error) => {
        console.log(`Fork error: ${error}`);
      });

      child.on("exit", (exitCode) => {
        // console.log(`For exitcode ${exitCode}`);
      });
    } catch (e) {
      console.log(e);
      res.status(500).send(`Server error generating image for ${seed} x ${size}`);
    }
  });
}

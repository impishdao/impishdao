/* eslint-disable node/no-unpublished-import */
import contractAddresses from "./contracts/contract-addresses.json";
import SpiralMarketArtifact from "./contracts/spiralmarket.json";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";

import express from "express";
import fs from "fs";

import { BigNumber, ethers } from "ethers";
import lineReader from "line-reader";

type SpiralForSale = {
  tokenId: BigNumber;
  owner: string;
  price: BigNumber;
};

const spiralsForSale = new Map<number, SpiralForSale>();

export function setupSpiralMarket(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _spiralmarket = new ethers.Contract(contractAddresses.SpiralMarket, SpiralMarketArtifact.abi, provider);

  const processMarketEvent = (eventType: number, tokenId: BigNumber, address: string, price: BigNumber) => {
    switch (eventType) {
      case 1: {
        spiralsForSale.set(tokenId.toNumber(), { tokenId, owner: address, price });
        break;
      }
      case 2: {
        spiralsForSale.delete(tokenId.toNumber());
        break;
      }
      case 3: {
        // Was sold, remove it from the forSale list
        spiralsForSale.delete(tokenId.toNumber());
        break;
      }
    }
  };

  const processMarketEventsAtStartup = () => {
    // Read previous Logs
    lineReader.eachLine("data/spiral_market_logs.json", (line) => {
      const { eventType, tokenId, address, price } = JSON.parse(line);
      processMarketEvent(eventType, BigNumber.from(tokenId), address, BigNumber.from(price));
    });

    // Setup an event listener
    _spiralmarket.on(
      _spiralmarket.filters.SpiralMarketEvent(),
      async (eventType: number, tokenId: BigNumber, address: string, price: BigNumber, event: any) => {
        const timestamp = (await event.getBlock()).timestamp;
        console.log(
          // eslint-disable-next-line max-len
          `New Market Event. Type: ${eventType} tokenId: ${tokenId.toString()} price: ${price.toString()} address: ${address}`
        );
        processMarketEvent(eventType, tokenId, address, price);

        if (!fs.existsSync("data")) {
          fs.mkdirSync("data");
        }

        fs.appendFile(
          "data/spiral_market_logs.json",
          JSON.stringify({ eventType, tokenId, address, price, timestamp }) + "\n",
          function (err) {
            if (err) throw err;
          }
        );
      }
    );
  };

  const spiralTransferListner = async (from: string, to: string, tokenId: BigNumber, event: any) => {
    // Remove this tokenID from sale list as it was transfered.
    spiralsForSale.delete(tokenId.toNumber());
  };

  // Read everything at startup
  processMarketEventsAtStartup();

  app.get("/marketapi/forsale", async (req, res) => {
    const j = Array.from(spiralsForSale.values());

    j.sort((a, b) => {
      if (a.price.gt(b.price)) {
        return 1;
      } else if (a.price.lt(b.price)) {
        return -1;
      } else {
        return 0;
      }
    });

    res.contentType("application/json");
    res.send(JSON.stringify(j));
  });

  app.get("/marketapi/listing/:id", async (req, res) => {
    const tokenId = parseInt(req.params.id);
    if (spiralsForSale.has(tokenId)) {
      res.contentType("application/json");
      res.send(JSON.stringify(spiralsForSale.get(tokenId)));
    } else {
      res.send({});
    }
  });

  app.get("/marketapi/isListingValid/:id", async (req, res) => {
    try {
      const tokenId = parseInt(req.params.id);

      const valid = await _spiralmarket.isListingValid(tokenId);
      res.send({ valid });
    } catch (err) {
      console.log(err);
      res.send({});
    }
  });

  app.get("/marketapi/uniswapv3prices", async (req, res) => {
    const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
    const WETH9 = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const IMPISH = "0x36F6d831210109719D15abAEe45B327E9b43D6C6";
    const SPIRALBITS = "0x650A9960673688Ba924615a2D28c39A8E015fB19";
    const POOL_FEE = 10000;

    const quoterContract = new ethers.Contract(quoterAddress, QuoterABI, provider);

    const quotedAmountEth = await quoterContract.callStatic.quoteExactOutputSingle(
      WETH9,
      IMPISH,
      POOL_FEE,
      ethers.utils.parseEther("100"),
      0
    );

    const path = ethers.utils.solidityPack(
      ["address", "uint24", "address", "uint24", "address"],
      [IMPISH, POOL_FEE, WETH9, POOL_FEE, SPIRALBITS]
    );

    const quotedAmountSpiralBits = await quoterContract.callStatic.quoteExactOutput(
      path,
      ethers.utils.parseEther("100")
    );

    res.send({ ETHper100Impish: quotedAmountEth, SPIRALBITSper100Impish: quotedAmountSpiralBits });
  });

  return [spiralTransferListner];
}

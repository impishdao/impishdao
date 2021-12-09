/* eslint-disable node/no-unpublished-import */
import express from "express";
import fs from "fs";
import got from "got";

import lineReader from "line-reader";
import { BigNumber, ethers } from "ethers";
import RandomWalkNFTArtifact from "./contracts/rwnft.json";
import ImpishDAOArtifact from "./contracts/impdao.json";
import contractAddresses from "./contracts/contract-addresses.json";
import ImpishDAOConfig from "./impishdao-config.json";
import path from "path";

const app = express();

const ARBITRUM_RPC =
  ImpishDAOConfig.RPCEndPoint || "https://arb1.arbitrum.io/rpc";

const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);

// When, we initialize the contract using the provider and the token's
// artifacts.
const _impdao = new ethers.Contract(
  contractAddresses.ImpishDAO,
  ImpishDAOArtifact.abi,
  provider
);

const _rwnft = new ethers.Contract(
  contractAddresses.RandomWalkNFT,
  RandomWalkNFTArtifact.abi,
  provider
);

const nftsAvailable = new Set<number>();

const processEvent = (
  tokenID: number,
  price: BigNumber,
  forSale: boolean,
  timestamp: number
) => {
  // If this is for sale, add it to the list of available NFTs
  if (forSale) {
    // Make sure to not add duplicates
    if (!nftsAvailable.has(tokenID)) {
      nftsAvailable.add(tokenID);
      console.log(`Adding ${tokenID.toString()}`);
    }
  } else {
    // If this NFT was sold, remove it from the list
    if (nftsAvailable.has(tokenID)) {
      console.log(`TokenID ${tokenID} sold for ${price}`);
      nftsAvailable.delete(tokenID);
    } else {
      console.log(`TokenID: ${tokenID} was sold, but not found in the map`);
    }
  }
};

// At startup, process previous event logs
function processEventLogsStartup() {
  // Read previous Logs
  lineReader.eachLine("data/nft_sale_logs.json", (line) => {
    const { tokenID, price, forSale, timestamp } = JSON.parse(line);
    processEvent(
      BigNumber.from(tokenID).toNumber(),
      BigNumber.from(price),
      forSale,
      timestamp
    );
  });

  // And then setup the event listener for the NFT sale events
  _impdao.on(
    _impdao.filters.NFTForSaleTx(),
    async (
      tokenID: BigNumber,
      price: BigNumber,
      forSale: boolean,
      event: any
    ) => {
      const timestamp = (await event.getBlock()).timestamp;
      console.log(
        // eslint-disable-next-line max-len
        `New Event. ID: ${tokenID.toString()} startTime: ${timestamp} startPrice: ${price.toString()} forSale: ${forSale}`
      );
      fs.appendFile(
        "data/nft_sale_logs.json",
        JSON.stringify({ tokenID, price, forSale, timestamp }) + "\n",
        function (err) {
          if (err) throw err;
        }
      );

      processEvent(tokenID.toNumber(), price, forSale, timestamp);
    }
  );
}
processEventLogsStartup();

// Prices
let lastETHPrice: number = 0;
let lastETHPriceCacheExpiry = 0;
async function getLastETHPrice(): Promise<number> {
  if (lastETHPrice > 0 && lastETHPriceCacheExpiry < Date.now()) {
    return lastETHPrice;
  }

  // Get the price from Binance
  try {
    const response = await got(
      "https://api.binance.com/api/v3/avgPrice?symbol=ETHUSDC"
    );
    const data = JSON.parse(response.body);
    lastETHPrice = parseFloat(data.price) || 0;
    lastETHPriceCacheExpiry = Date.now() + 3600 * 1000; // ONE HOUR

    console.log(`Set eth price to ${lastETHPrice}`);
  } catch (error) {
    console.log("Error getting prices!");
    console.log(error.response.body);
  }
}

// At startup, fetch the ETH Price.
getLastETHPrice();

const nftPriceCache = new Map<number, BigNumber>();
let nftPriceCacheExpiry = Date.now();

app.get("/api", async (req, res) => {
  // impdao methods
  const [areWeWinning, contractState, daoBalance, totalTokenSupply] =
    await Promise.all([
      _impdao?.areWeWinning(),
      _impdao?.contractState(),
      provider.getBalance(_impdao.address),
      _impdao?.totalSupply(),
    ]);

  // RandomwalkNFT methods
  const [roundNum, numWithdrawals, mintPrice, lastMintTime, withdrawalAmount] =
    await Promise.all([
      _impdao?.RWNFT_ROUND(),
      _rwnft?.numWithdrawals(),
      _rwnft?.getMintPrice(),
      _rwnft?.lastMintTime(),
      _rwnft?.withdrawalAmount(),
    ]);

  const isRoundFinished = !BigNumber.from(roundNum).eq(
    BigNumber.from(numWithdrawals)
  );

  // See if the NFT price cache is valid. Expire every hour
  if (nftPriceCacheExpiry < Date.now()) {
    nftPriceCache.clear();
    // eslint-disable-next-line prettier/prettier
    nftPriceCacheExpiry = Date.now() + (1 * 3600 * 1000); // 1hour
  }

  const nftsWithPrice = (
    await Promise.all(
      Array.from(nftsAvailable).map(async (tokenId) => {
        try {
          let price = nftPriceCache.get(tokenId);
          if (!price) {
            price = await _impdao.buyNFTPrice(tokenId);
            nftPriceCache.set(tokenId, price);
          }

          return { tokenId, price };
        } catch (e) {
          console.log(`Error ${e}`);
          return {};
        }
      })
    )
  ).filter((n) => n.tokenId !== undefined);

  const sendJson = {
    blockNumber: await provider.getBlockNumber(),
    totalTokenSupply,
    areWeWinning,
    contractState,
    isRoundFinished,
    mintPrice,
    lastMintTime,
    daoBalance,
    withdrawalAmount,
    nftsWithPrice,
    lastETHPrice,
  };

  res.send(sendJson);
});

// Serve static files
app.use("/", express.static(path.join(__dirname)));

app.listen(3001, () => console.log("Example app listening on port 3001!"));

/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unpublished-import */
import express from "express";
import fs from "fs";
import got from "got";
import path from "path";
import lineReader from "line-reader";
import { BigNumber, ethers } from "ethers";

import RandomWalkNFTArtifact from "./contracts/rwnft.json";
import ImpishDAOArtifact from "./contracts/impdao.json";
import SpiralStakingArtifact from "./contracts/spiralstaking.json";
import ImpishSpiralArtifact from "./contracts/impishspiral.json";
import contractAddresses from "./contracts/contract-addresses.json";
import ImpishDAOConfig from "./impishdao-config.json";
import { setupSpiralMarket } from "./marketServer";
import { fork } from "child_process";

const app = express();

const ARBITRUM_RPC = ImpishDAOConfig.RPCEndPoint || "https://arb1.arbitrum.io/rpc";

const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);

// When, we initialize the contract using the provider and the token's
// artifacts.
const _impdao = new ethers.Contract(contractAddresses.ImpishDAO, ImpishDAOArtifact.abi, provider);
const _rwnft = new ethers.Contract(contractAddresses.RandomWalkNFT, RandomWalkNFTArtifact.abi, provider);
const _impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiralArtifact.abi, provider);
const _spiralstaking = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStakingArtifact.abi, provider);

const nftsAvailable = new Set<number>();

const processEvent = (tokenID: number, price: BigNumber, forSale: boolean, timestamp: number) => {
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
    processEvent(BigNumber.from(tokenID).toNumber(), BigNumber.from(price), forSale, timestamp);
  });

  // And then setup the event listener for the NFT sale events
  _impdao.on(
    _impdao.filters.NFTForSaleTx(),
    async (tokenID: BigNumber, price: BigNumber, forSale: boolean, event: any) => {
      const timestamp = (await event.getBlock()).timestamp;
      console.log(
        // eslint-disable-next-line max-len
        `New Event. ID: ${tokenID.toString()} startTime: ${timestamp} startPrice: ${price.toString()} forSale: ${forSale}`
      );

      if (!fs.existsSync("data")) {
        fs.mkdirSync("data");
      }

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
    const response = await got("https://api.binance.com/api/v3/avgPrice?symbol=ETHUSDC");
    const data = JSON.parse(response.body);
    lastETHPrice = parseFloat(data.price) || 0;
    lastETHPriceCacheExpiry = Date.now() + 3600 * 1000; // ONE HOUR

    console.log(`Set eth price to ${lastETHPrice}`);
  } catch (error) {
    console.log("Error getting prices!");
    console.log(error.response.body);
  }
}

const nftPriceCache = new Map<number, BigNumber>();
let nftPriceCacheExpiry = Date.now();

// At startup, fetch the ETH Price.
getLastETHPrice();

// app.get("/rwnft_wallet/:address", async (req, res) => {
//   const address = req.params.address;
//   if (!address) {
//     res.send({});
//     return;
//   }

//   try {
//     console.log(`Fetching wallet of ${address}`);
//     const tokenIDs = await _rwnft.walletOfOwner(address);
//     res.send(tokenIDs);
//   } catch (err) {
//     console.log("Wallet error");
//     console.log(err);
//   }
// });

type RadomWalkNFTData = {
  roundNum: BigNumber;
  numWithdrawals: BigNumber;
  mintPrice: BigNumber;
  lastMintTime: BigNumber;
  withdrawalAmount: BigNumber;
};
let rwNFTDataCache: RadomWalkNFTData;
let lastRWNFTDataMintPrice = BigNumber.from(0);

async function getRandomWalkNFTData(): Promise<RadomWalkNFTData> {
  const mintPrice = await _rwnft?.getMintPrice();
  if (rwNFTDataCache && mintPrice.eq(lastRWNFTDataMintPrice)) {
    return rwNFTDataCache;
  } else {
    const [roundNum, numWithdrawals, lastMintTime, withdrawalAmount] = await Promise.all([
      _impdao?.RWNFT_ROUND(),
      _rwnft?.numWithdrawals(),
      _rwnft?.lastMintTime(),
      _rwnft?.withdrawalAmount(),
    ]);

    rwNFTDataCache = { roundNum, numWithdrawals, lastMintTime, mintPrice, withdrawalAmount };
    lastRWNFTDataMintPrice = mintPrice;

    return rwNFTDataCache;
  }
}

app.get("/api", async (req, res) => {
  try {
    // impdao methods
    const [areWeWinning, contractState, daoBalance, totalTokenSupply] = await Promise.all([
      _impdao?.areWeWinning(),
      _impdao?.contractState(),
      provider.getBalance(_impdao.address),
      _impdao?.totalSupply(),
    ]);

    // RandomwalkNFT methods
    const rwNFTData = await getRandomWalkNFTData();

    const isRoundFinished = !BigNumber.from(rwNFTData.roundNum).eq(BigNumber.from(rwNFTData.numWithdrawals));

    // See if the NFT price cache is valid. Expire every hour
    if (nftPriceCacheExpiry < Date.now()) {
      nftPriceCache.clear();
      // eslint-disable-next-line prettier/prettier
      nftPriceCacheExpiry = Date.now() + 6 * 3600 * 1000; // 6 hours
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
      daoBalance,
      nftsWithPrice,
      ...rwNFTData,
    };

    res.send(sendJson);
  } catch (err) {
    console.log("API error");
    console.log(err);

    res.send({});
  }
});

app.get("/lastethprice", async (req, res) => {
  res.send({ lastETHPrice });
});

_impishspiral.on(_impishspiral.filters.Transfer(), async (from: string, to: string, tokenId: BigNumber, e: any) => {
  console.log(`Spiral transfered: ${from} -> ${to} for # ${tokenId.toString()}`);

  // For transfer events, we remove the spiral data cache
  seedToIdCache.delete(tokenId.toNumber());

  // Also send to marketplace listener
  transferListener(from, to, tokenId, e);
});

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
    res.send(JSON.stringify(r));
  } catch (err) {
    res.status(500).send("Something went wrong generating metadata");
  }
});

type SeedToIDValue = {
  id: BigNumber;
  seed: string;
  owner: string;
  indirectOwner: string;
};
const seedToIdCache = new Map<number, SeedToIDValue>();
app.get("/spiralapi/seedforid/:id", async (req, res) => {
  try {
    const id = BigNumber.from(req.params.id);

    if (seedToIdCache.has(id.toNumber())) {
      res.send(seedToIdCache.get(id.toNumber()));
      return;
    }

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
    }

    seedToIdCache.set(id.toNumber(), { id, seed, owner, indirectOwner });

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
      // console.log("Message recieved from child");
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

// Setup Market
const [transferListener] = setupSpiralMarket(app, provider);

// Serve static files
app.use("/spirals", express.static(path.join(__dirname, "index.html")));
app.use("/spirals/*", express.static(path.join(__dirname, "index.html")));
app.use("/spiralstaking", express.static(path.join(__dirname, "index.html")));

app.use("/crystals", express.static(path.join(__dirname, "index.html")));

app.use("/impishdao", express.static(path.join(__dirname, "index.html")));
app.use("/impishdao/*", express.static(path.join(__dirname, "index.html")));

app.use("/", express.static(path.join(__dirname)));

app.listen(3001, () => console.log("Example app listening on port 3001!"));

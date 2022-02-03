/* eslint-disable node/no-unpublished-import */
import { BigNumber, ethers } from "ethers";
import express from "express";

import Crystal from "./contracts/crystal.json";
import SpiralStakingArtifact from "./contracts/spiralstaking.json";
import ImpishSpiralArtifact from "./contracts/impishspiral.json";
import StakingV2Artifact from "./contracts/stakingv2.json";
import contractAddresses from "./contracts/contract-addresses.json";
import { crystal_image } from "./serverCrystalRenderer";

export function setupCrystals(app: express.Express, provider: ethers.providers.JsonRpcProvider) {
  const _crystal = new ethers.Contract(contractAddresses.Crystal, Crystal.abi, provider);
  const _impishspiral = new ethers.Contract(contractAddresses.ImpishSpiral, ImpishSpiralArtifact.abi, provider);
  const _spiralstaking = new ethers.Contract(contractAddresses.SpiralStaking, SpiralStakingArtifact.abi, provider);
  const _v2staking = new ethers.Contract(contractAddresses.StakingV2, StakingV2Artifact.abi, provider);

  app.get("/crystalapi/wallet/:address", async (req, res) => {
    const address = req.params.address;

    try {
      const wallet = (await _crystal.walletOfOwner(address)) as Array<BigNumber>;
      res.send(wallet);
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong fetch address NFTs");
    }
  });

  app.get("/crystalapi/mintedforspiral/:spiralTokenId", async (req, res) => {
    const spiralTokenId = req.params.spiralTokenId;

    try {
      const mintedTokenIds = await Promise.all(
        [0, 1, 2, 3, 4].map(async (gen) => {
          const { minted, tokenId } = await _crystal.mintedSpirals(spiralTokenId, gen);
          if (minted) {
            return tokenId as number;
          } else {
            return -1;
          }
        })
      );

      res.send(mintedTokenIds);
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong getting mintedforspiral");
    }
  });

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

    try {
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
            minted.push(bit);
          }
          minted.reverse();

          return { spiralId, minted };
        })
      );

      res.send(r);
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong getting getmintable");
    }
  });

  type CrystalInfo = {
    size: number;
    generation: number;
    sym: number;
    seed: BigNumber;
    spiralBitsStored: BigNumber;
    owner: string;
    indirectOwner: string;
  };
  const crystalMetadataCache = new Map<number, CrystalInfo>();
  app.get("/crystalapi/crystal/metadata/:id", async (req, res) => {
    try {
      const id = BigNumber.from(req.params.id);

      let attributes;
      if (crystalMetadataCache.has(id.toNumber())) {
        attributes = crystalMetadataCache.get(id.toNumber());
      } else {
        const crystalInfo: CrystalInfo = await _crystal.crystals(id);
        const owner = await _crystal.ownerOf(id);

        let indirectOwner;
        if (owner === contractAddresses.StakingV2) {
          // Get the indirect owner
          indirectOwner = (await _v2staking.stakedTokenOwners(id.add(3000000))).owner as string;
          console.log(`indirect owner ${indirectOwner} of type ${typeof indirectOwner}`);
          if (BigNumber.from(indirectOwner).eq(0)) {
            indirectOwner = (await _v2staking.stakedTokenOwners(id.add(4000000))).owner as string;
          }
        }

        attributes = {
          size: crystalInfo.size,
          generation: crystalInfo.generation,
          sym: crystalInfo.sym,
          seed: BigNumber.from(crystalInfo.seed),
          spiralBitsStored: crystalInfo.spiralBitsStored,
          owner,
          indirectOwner,
        };
        crystalMetadataCache.set(id.toNumber(), attributes);
      }
      const r = {
        image: `https://impishdao.com/crystalapi/crystal/image/${id.toString()}.png`,
        description: "ImpishDAO Crystals",
        attributes,
      };

      res.contentType("application/json");
      res.send(JSON.stringify(r));
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong generating metadata");
    }
  });

  app.get("/crystalapi/crystal/image/:tokenId.png", async (req, res) => {
    try {
      const id = BigNumber.from(req.params.tokenId);
      const crystalInfo: CrystalInfo = await _crystal.crystals(id);

      const pngBuf = crystal_image(
        BigNumber.from(crystalInfo.seed).toHexString(),
        crystalInfo.sym,
        crystalInfo.generation,
        crystalInfo.size / 100
      );

      res.contentType("png");
      res.send(pngBuf);
    } catch (err) {
      console.log(err);
      res.status(500).send("Something went wrong generating metadata");
    }
  });

  // Event listner
  _crystal.on(
    _crystal.filters.CrystalChangeEvent(),
    async (tokenId: number, eventType: number, size: number, event: any) => {
      console.log(`New Crystal Event ${tokenId} type: ${eventType} size: ${size}`);
      crystalMetadataCache.delete(tokenId);
    }
  );

  _crystal.on(_crystal.filters.Transfer(), async (from: string, to: string, tokenId: BigNumber, e: any) => {
    console.log(`Crystal transfered: ${from} -> ${to} for # ${tokenId.toString()}`);
    crystalMetadataCache.delete(tokenId.toNumber());
  });
}

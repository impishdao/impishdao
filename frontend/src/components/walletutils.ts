import { BigNumber } from "ethers";
import { CrystalInfo, NFTCardInfo, SpiralDetail } from "../AppState";
import { crystal_image } from "../crystalRenderer";
import { pad } from "./utils";

export async function getMetadataForCrystalTokenIds(tokenIds: Array<BigNumber>): Promise<Array<CrystalInfo>> {
  const crystalDetails = await Promise.all(
    tokenIds.map(async (t) => {
      try {
        const tokenId = BigNumber.from(t);
        const url = `/crystalapi/crystal/metadata/${tokenId.toString()}`;
        const { attributes } = await (await fetch(url)).json();

        const info = {
          tokenId,
          size: attributes.size,
          generation: attributes.generation,
          sym: attributes.sym,
          seed: BigNumber.from(attributes.seed),
          spiralBitsStored: BigNumber.from(attributes.spiralBitsStored),
          owner: attributes.owner,
        };

        return info;
      } catch (err) {
        console.log(err);
        return {};
      }
    })
  );

  const filtered = crystalDetails.filter((d: any) => d.seed) as Array<CrystalInfo>;
  filtered.sort((a, b) => b.tokenId.toNumber() - a.tokenId.toNumber());

  return filtered;
}

export async function getSeedsForSpiralTokenIds(data: Array<BigNumber>): Promise<Array<SpiralDetail>> {
  // Map all the data to get the seeds
  const spiralDetails = await Promise.all(
    (data as Array<BigNumber>).map(async (t) => {
      try {
        const tokenId = BigNumber.from(t);
        const url = `/spiralapi/seedforid/${tokenId.toString()}`;
        const { seed } = await (await fetch(url)).json();

        return { tokenId, seed };
      } catch (err) {
        console.log(err);
        return {};
      }
    })
  );

  const filtered = spiralDetails.filter((d) => d.seed) as Array<SpiralDetail>;
  return filtered;
}

export function getNFTCardInfo(
  rwNFTs?: BigNumber[],
  spiralNFTs?: SpiralDetail[],
  crystalNFTs?: CrystalInfo[]
): NFTCardInfo[] {
  let result =
    rwNFTs?.map((tokenId) => {
      const paddedTokenId = pad(tokenId.toString(), 6);
      const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;

      return new NFTCardInfo(tokenId.toNumber(), 1000000, imgurl);
    }) || [];

  result = result.concat(
    spiralNFTs?.map((spiral) => {
      return new NFTCardInfo(spiral.tokenId.toNumber(), 2000000, `/spiral_image/seed/${spiral.seed}/75.png`);
    }) || []
  );

  result = result.concat(
    crystalNFTs?.map((crystal) => {
      const contractMultiplier = crystal.size === 100 ? 4000000 : 3000000;
      return new NFTCardInfo(
        crystal.tokenId.toNumber(),
        contractMultiplier,
        crystal_image(crystal.seed.toHexString(), crystal.sym, crystal.generation, crystal.size / 100)
      );
    }) || []
  );

  return result;
}

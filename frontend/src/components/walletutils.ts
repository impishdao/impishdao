import { BigNumber, ethers } from "ethers";
import { CrystalInfo, NFTCardInfo, SpiralDetail } from "../AppState";
import { crystal_image } from "../crystalRenderer";
import { pad } from "./utils";

export type MultiTxItem = {
  tx: () => Promise<any> | undefined;
  title: string;
};

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
          indirectOwner: attributes.indirectOwner,
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

export function getCrystalImage(crystal: CrystalInfo): string {
  return crystal_image(crystal.seed.toHexString(), crystal.sym, crystal.generation, crystal.size / 100);
}

export function getNFTCardInfo(
  nftWallet: BigNumber[],
  rwNFTs?: BigNumber[],
  spiralNFTs?: SpiralDetail[],
  crystalNFTs?: CrystalInfo[]
): NFTCardInfo[] {
  let result =
    rwNFTs?.map((tokenId) => {
      const paddedTokenId = pad(tokenId.toString(), 6);
      const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;

      return new NFTCardInfo(tokenId.toNumber(), 1000000, imgurl, tokenId);
    }) || [];

  result = result.concat(
    spiralNFTs?.map((spiral) => {
      return new NFTCardInfo(spiral.tokenId.toNumber(), 2000000, `/spiral_image/seed/${spiral.seed}/75.png`, spiral);
    }) || []
  );

  // Build the contract multiplier Map
  const contractMultiplierMap = new Map<number, number>();
  nftWallet.forEach((contractTokenId) => {
    const [tokenId, contractMultiplier] = NFTCardInfo.SplitFromContractTokenId(contractTokenId);
    contractMultiplierMap.set(tokenId.toNumber(), contractMultiplier.toNumber());
  });

  result = result.concat(
    crystalNFTs?.map((crystal) => {
      const contractMultiplier =
        contractMultiplierMap.get(crystal.tokenId.toNumber()) || (crystal.size < 100 ? 3000000 : 4000000);

      return new NFTCardInfo(
        crystal.tokenId.toNumber(),
        contractMultiplier,
        getCrystalImage(crystal),
        crystal
      );
    }) || []
  );

  return result;
}

export const Eth1 = ethers.utils.parseEther("1");
export const Eth1k = ethers.utils.parseEther("1000");
export const Eth1M = ethers.utils.parseEther("1000000");
export const Eth2B = ethers.utils.parseEther("2000000000");

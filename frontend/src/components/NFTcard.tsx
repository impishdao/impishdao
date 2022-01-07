import { BigNumber } from "ethers";
import { Button, Card } from "react-bootstrap";
import { formatkmb, pad } from "./utils";

type NFTCardProps = {
  selectedAddress?: string;
  buyNFTFromDAO: (tokenId: BigNumber, price: BigNumber) => Promise<void>;
  tokenId: BigNumber;
  nftPriceImpish?: BigNumber;
  ethPer100Impish: BigNumber;
  spiralBitsPer100Impish: BigNumber;
  priceIn: string;
};

export function NFTCard({
  selectedAddress,
  nftPriceImpish,
  ethPer100Impish,
  spiralBitsPer100Impish,
  priceIn,
  buyNFTFromDAO,
  tokenId,
}: NFTCardProps) {
  const paddedTokenId = pad(tokenId.toString(), 6);
  const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;
  const showPrice = nftPriceImpish && nftPriceImpish.gt(0);
  
  let price = BigNumber.from(0);
  if (nftPriceImpish) {
    switch (priceIn) {
      case "ETH": { price = nftPriceImpish.mul(ethPer100Impish.div(100)).div(BigNumber.from(10).pow(18)); break; }
      case "IMPISH": { price = nftPriceImpish; break; }
      case "SPIRALBITS": { price = nftPriceImpish.mul(spiralBitsPer100Impish.div(100)).div(BigNumber.from(10).pow(18)); break; }
    }
  }

  const priceStr = `${formatkmb(price)} ${priceIn}`;

  const buyEnabled = selectedAddress && buyNFTFromDAO;

  return (
    <Card style={{ width: "320px", padding: "10px", borderRadius: "5px" }} key={tokenId.toString()}>
      <a
        style={{ color: "white" }}
        target="_blank"
        rel="noreferrer"
        href={`https://randomwalknft.com/detail/${paddedTokenId}`}
      >
        <Card.Img variant="top" src={imgurl} style={{ maxWidth: "300px" }} />
      </a>
      <Card.Body>
        <Card.Title>
          <a
            style={{ color: "white" }}
            target="_blank"
            rel="noreferrer"
            href={`https://randomwalknft.com/detail/${paddedTokenId}`}
          >
            #{paddedTokenId}
          </a>
        </Card.Title>
        {showPrice && <Card.Text>{priceStr}</Card.Text>}
        <Button variant="primary" onClick={() => buyNFTFromDAO(tokenId, price)} disabled={!buyEnabled}>
          Buy Now
        </Button>
      </Card.Body>
    </Card>
  );
}

type SelectableNFTProps = {
  tokenId: BigNumber;
  selected: boolean;
  onClick: () => void;
};
export function SelectableNFT({ tokenId, onClick, selected }: SelectableNFTProps) {
  const paddedTokenId = pad(tokenId.toString(), 6);
  const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;
  let borderProps = {};
  if (selected) {
    borderProps = { borderColor: "#ffd454", borderWidth: "4px" };
  }

  return (
    <Card style={{ width: "160px", height: "160px", borderRadius: "5px", ...borderProps }} onClick={onClick}>
      <Card.Img variant="top" src={imgurl} style={{ maxWidth: "150px" }} />
      <Card.Body>#{paddedTokenId}</Card.Body>
    </Card>
  );
}

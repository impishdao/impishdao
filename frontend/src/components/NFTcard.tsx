import { BigNumber, ethers } from "ethers";
import { Button, Card } from "react-bootstrap";
import { pad } from "./utils";

type NFTCardProps = {
  selectedAddress?: string;
  buyNFTFromDAO: (tokenId: BigNumber) => Promise<void>;
  tokenId: BigNumber;
  nftPrice: BigNumber;
};

export default function NFTCard({ selectedAddress, nftPrice, buyNFTFromDAO, tokenId }: NFTCardProps) {
  const paddedTokenId = pad(tokenId.toString(), 6);
  const imgurl = `https://randomwalknft.s3.us-east-2.amazonaws.com/${paddedTokenId}_black_thumb.jpg`;
  const price = parseFloat(ethers.utils.formatEther(nftPrice)).toFixed(4);

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
        <Card.Text>Price: {price} IMPISH</Card.Text>
        {selectedAddress && (
          <Button variant="primary" onClick={() => buyNFTFromDAO(tokenId)}>
            Buy Now
          </Button>
        )}
      </Card.Body>
    </Card>
  );
}

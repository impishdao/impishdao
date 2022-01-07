/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { BigNumber, ContractTransaction } from "ethers";
import { useEffect, useState } from "react";
import { Button, ButtonGroup, Col, Dropdown, Row } from "react-bootstrap";
import { DappContracts, DappFunctions, DappState, ERROR_CODE_TX_REJECTED_BY_USER } from "../AppState";
import { NFTCard } from "./NFTcard";
import { pad, range } from "./utils";

type ImpishDAOBuyNFTsProps = DappState & DappFunctions & DappContracts & {};

export function ImpishDAOBuyNFTs(props: ImpishDAOBuyNFTsProps) {
  const [startPage, setStartPage] = useState(0);
  const [priceIn, setPriceIn] = useState("ETH");

  const [ethPer100Impish, setEthPer100Impish] = useState(BigNumber.from(0));
  const [spiralBitsPer100Impish, setSpiralBitsPer100Impish] = useState(BigNumber.from(0));

  const PAGE_SIZE = 16;
  const numPages = Math.floor(props.nftsWithPrice.length / PAGE_SIZE) + 1;

  useEffect(() => {
    // Fetch prices
    fetch("/marketapi/uniswapv3prices")
      .then((r) => r.json())
      .then((data) => {
        const { ETHper100Impish, SPIRALBITSper100Impish } = data;
        setEthPer100Impish(BigNumber.from(ETHper100Impish));
        setSpiralBitsPer100Impish(BigNumber.from(SPIRALBITSper100Impish));
      });
  }, []);

  const PageList = () => {
    return (
      <Row className="mb-2">
        {numPages > 1 && (
          <Col xs={{ span: 6, offset: 3 }}>
            <div style={{ display: "flex", flexDirection: "row", gap: "10px", justifyContent: "center" }}>
              Pages
              {range(numPages).map((p) => {
                const textDecoration = p === startPage ? "underline" : "";
                return (
                  <div key={p} style={{ cursor: "pointer" }} onClick={() => setStartPage(p)}>
                    <span style={{ textDecoration }}>{p}</span>
                  </div>
                );
              })}
            </div>
          </Col>
        )}
      </Row>
    );
  };

  const buyNFTFromDAO = async (tokenId: BigNumber) => {
    // Wait for this Tx to be mined, then refresh all data.
    try {
      let tx: ContractTransaction = await props.impdao?.buyNFT(tokenId);

      await tx.wait();
      const tokenIdPadded = pad(tokenId.toString(), 6);

      props.showModal(
        "Congrats on your new NFT!",
        <div>
          Congrats on purchasing RandomWalkNFT #{tokenIdPadded}
          <br />
          <a href={`https://randomwalknft.com/detail/${tokenIdPadded}`} target="_blank" rel="noreferrer">
            View on RandomWalkNFT
          </a>
        </div>
      );

      // Set a timer to refresh data after a few seconds, so that the server has time to process the event
      setTimeout(() => {
        props.readDappState();
        props.readUserData();
      }, 1000 * 5);
    } catch (e: any) {
      console.log(e);

      // If user didn't cancel
      if (e?.code !== ERROR_CODE_TX_REJECTED_BY_USER) {
        props.showModal(
          "Not Enough IMPISH Tokens!",
          <div>
            You don't have enough IMPISH tokens to buy this NFT!
            <br />
            Buy IMPISH tokens by contributing to ImpishDAO or from{" "}
            <a
              href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x36f6d831210109719d15abaee45b327e9b43d6c6"
              target="_blank"
              rel="noreferrer"
            >
              Uniswap
            </a>
          </div>
        );
      }
    }
  };

  return (
    <>
      {props.nftsWithPrice.length > 0 && (
        <>
          <Row className="mt-3" style={{ textAlign: "center", padding: "20px" }}>
            <h1>RandomWalkNFTs for Sale</h1>
          </Row>

          <Row className="mb-5 mt-2">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}></div>
          </Row>

          <Row style={{ backgroundColor: "#333", padding: "20px" }}>
            <Col xs={8}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                <div>Prices In:</div>

                <Dropdown as={ButtonGroup} variant="secondary" title="ETH" onSelect={(e) => setPriceIn(e || "")}>
                  <Dropdown.Toggle variant="secondary">{priceIn}</Dropdown.Toggle>
                  <Dropdown.Menu variant="dark">
                    <Dropdown.Item eventKey="ETH">ETH</Dropdown.Item>
                    <Dropdown.Item eventKey="IMPISH">IMPISH</Dropdown.Item>
                    <Dropdown.Item eventKey="SPIRALBITS">SPIRALBITS</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>

            <Col xs={4}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "end",
                  gap: "10px",
                }}
              >
                {!props.selectedAddress && (
                  <Button
                    className="connect mb-2"
                    variant="warning"
                    style={{ maxWidth: "150px" }}
                    onClick={props.connectWallet}
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
            </Col>
          </Row>

          <Row className="justify-content-md-center mt-3">
            <PageList />
            <Row>
              {props.nftsWithPrice.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((nft) => {
                return (
                  <Col xl={3} className="mb-3" key={nft.tokenId.toString()}>
                    <NFTCard
                      selectedAddress={props.selectedAddress}
                      nftPriceImpish={nft.price}
                      ethPer100Impish={ethPer100Impish}
                      spiralBitsPer100Impish={spiralBitsPer100Impish}
                      priceIn={priceIn}
                      buyNFTFromDAO={buyNFTFromDAO}
                      tokenId={nft.tokenId}
                    />
                  </Col>
                );
              })}
            </Row>
            <PageList />
          </Row>
        </>
      )}
    </>
  );
}

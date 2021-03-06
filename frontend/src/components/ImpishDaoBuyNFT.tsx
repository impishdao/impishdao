/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
import { BigNumber, ContractTransaction } from "ethers";
import { useEffect, useState } from "react";
import { Button, ButtonGroup, Col, Dropdown, Row } from "react-bootstrap";
import { DappFunctions, DappState, ERROR_CODE_TX_REJECTED_BY_USER } from "../AppState";
import { NFTCard } from "./NFTcard";
import { formatkmb, pad, range, retryTillSucceed } from "./utils";

type ImpishDAOBuyNFTsProps = DappState & DappFunctions & {};

export function ImpishDAOBuyNFTs(props: ImpishDAOBuyNFTsProps) {
  const [startPage, setStartPage] = useState(0);
  const [priceIn, setPriceIn] = useState("ETH");
  const [spiralbitsAllowance, setSpiralbitsAllowance] = useState(BigNumber.from(0));

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

  // Check if SpiralBits -> BuyWithEther contract needs approval
  useEffect(() => {
    retryTillSucceed(async () => {
      if (props.selectedAddress && props.contracts) {
        const allowance = await props.contracts.spiralbits.allowance(
          props.selectedAddress,
          props.contracts.buywitheth.address
        );
        setSpiralbitsAllowance(allowance);
      }
    });
  }, [props.contracts, props.selectedAddress]);

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

  const buyNFTFromDAO = async (tokenId: BigNumber, price: BigNumber) => {
    // Wait for this Tx to be mined, then refresh all data.
    try {
      let tx: Promise<ContractTransaction> | undefined;
      switch (priceIn) {
        case "IMPISH": {
          tx = props.contracts?.impdao.buyNFT(tokenId);
          break;
        }
        case "ETH": {
          tx = props.contracts?.buywitheth.buyRwNFTFromDaoWithEth(tokenId, false, { value: price });
          break;
        }
        case "SPIRALBITS": {
          if (props.contracts) {
            if (spiralbitsAllowance.lt(price)) {
              const approveTx = props.contracts.spiralbits.approve(
                props.contracts.buywitheth.address,
                BigNumber.from(10).pow(18 + 10)
              );
              await props.waitForTxConfirmation(approveTx, "Approving");
            }

            tx = props.contracts?.buywitheth.buyRwNFTFromDaoWithSpiralBits(tokenId, price, false);
          }
          break;
        }
      }

      if (tx) {
        await props.waitForTxConfirmation(tx, "Buying RandomWalkNFT");
      }

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
          `Not Enough ${priceIn}!`,
          <div>
            You don't have enough {priceIn} to buy this NFT!
            <br />
            Buy {priceIn} {priceIn === "IMPISH" && "by contributing to ImpishDAO or"} from{" "}
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

  const walletBalance = `${formatkmb(
    priceIn === "ETH" ? props.ethBalance : priceIn === "IMPISH" ? props.impishTokenBalance : props.spiralBitsBalance
  )} ${priceIn}`;

  return (
    <>
      {props.nftsWithPrice.length > 0 && (
        <>
          <Row className="mb-2" style={{ textAlign: "center", padding: "20px", marginTop: "65px" }}>
            <h1>RandomWalkNFTs for Sale</h1>
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

                {props.selectedAddress && (
                  <>
                    <div>Wallet:</div>
                    <div>{walletBalance}</div>
                  </>
                )}
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
                      spiralbitsAllowance={spiralbitsAllowance}
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

import { BigNumber, Contract, ContractTransaction, ethers } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Container, Form, ListGroup, Modal, Row, Table } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DappState, ERROR_CODE_TX_REJECTED_BY_USER, SpiralsState } from "../AppState";
import { setup_image } from "../spiralRenderer";
import { Navigation } from "./Navigation";
import { TransferAddressModal } from "./NFTTransferModal";
import { format4Decimals, formatUSD, secondsToDhms, THREE_DAYS } from "./utils";

type MarketPriceModalProps = {
  show: boolean;
  message: JSX.Element;
  modalNeedsApproval: boolean;
  spiralmarket?: Contract;
  impishspiral?: Contract;
  tokenId: BigNumber;
  price: string;
  setPrice: (v: string) => void;
  close: () => void;
  success: () => void;
};
const MarketPriceModal = ({
  show,
  message,
  impishspiral,
  spiralmarket,
  modalNeedsApproval,
  tokenId,
  price,
  setPrice,
  close,
  success,
}: MarketPriceModalProps) => {
  const [approved, setApproved] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const approveMarketplace = async () => {
    if (!impishspiral || !spiralmarket) {
      return;
    }

    const tx = await impishspiral.setApprovalForAll(spiralmarket.address, true);
    setIsWaiting(true);
    await tx.wait();
    setIsWaiting(false);

    setApproved(true);
  };

  const listOnMarketplace = async () => {
    if (!impishspiral || !spiralmarket) {
      return;
    }

    const priceEth = ethers.utils.parseEther(price);
    const tx = await spiralmarket.listSpiral(tokenId, priceEth);
    setIsWaiting(true);
    await tx.wait();
    setIsWaiting(false);

    // And then close it
    close();
    success();
  };

  return (
    <Modal show={show} onHide={close}>
      <Modal.Header closeButton>
        <Modal.Title>Set Spiral #{tokenId.toString()} Price</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {message}
        <Form.Group className="mb-3">
          <Form.Label>Price (ETH)</Form.Label>
          <Form.Control
            type="number"
            step={0.01}
            placeholder="Price In ETH"
            value={price}
            onChange={(e) => setPrice(e.currentTarget.value)}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <ListGroup variant="flush" style={{ width: "100%" }}>
          {modalNeedsApproval && (
            <ListGroup.Item>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                <div>Approve the Spiral Marketplace</div>
                {!approved && (
                  <Button variant="warning" onClick={() => approveMarketplace()}>
                    Approve
                  </Button>
                )}
                {approved && <Badge bg="success">Done</Badge>}
              </div>
            </ListGroup.Item>
          )}
          {isWaiting && (
            <ListGroup.Item>
              <div>Waiting for confirmation...</div>
            </ListGroup.Item>
          )}
          <ListGroup.Item>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "end", gap: "10px" }}>
              {(!modalNeedsApproval || approved) && (
                <Button variant="warning" onClick={() => listOnMarketplace()}>
                  List On Marketplace
                </Button>
              )}
              <Button variant="primary" onClick={() => close()}>
                Cancel
              </Button>
            </div>
          </ListGroup.Item>
        </ListGroup>
      </Modal.Footer>
    </Modal>
  );
};

type SpiralDetailProps = DappState & {
  connectWallet: () => void;
  spiralmarket?: Contract;
  impishspiral?: Contract;

  showModal: (title: string, message: JSX.Element, modalCloseCallBack?: () => void) => void;
};

export function SpiralDetail(props: SpiralDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [seed, setSeed] = useState("");
  const [owner, setOwner] = useState("");
  const [indirectOwner, setIndirectOwner] = useState();
  const [spiralState, setSpiralState] = useState<SpiralsState | undefined>();
  const [mintedCrystals, setMintedCrystals] = useState<Array<number>>([]);

  const [listingPrice, setListingPrice] = useState(BigNumber.from(0));
  // const [listingOwner, setListingOwner] = useState("");

  const [refreshDataCounter, setRefreshDataCounter] = useState(0);

  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  useEffect(() => {
    // Fetch the spiral's details
    fetch("/spiralapi/spiraldata")
      .then((data) => data.json())
      .then((j) => {
        const lastMintTime = BigNumber.from(j.lastMintTime || 0);
        const nextTokenId = BigNumber.from(j.nextTokenId || 0);
        const totalReward = BigNumber.from(j.totalReward || 0);

        setTimeRemaining(lastMintTime.toNumber() + THREE_DAYS - Date.now() / 1000);
        setSpiralState({ lastMintTime, nextTokenId, totalReward });
      });

    // And listing details if it is on the marketplace
    fetch(`/marketapi/listing/${id}`)
      .then((data) => data.json())
      .then((j) => {
        console.log(`API returned ${JSON.stringify(j)}`);
        // const lstOwner = j.owner || "";
        const price = BigNumber.from(j.price || 0);

        // setListingOwner(lstOwner);
        setListingPrice(price);
      });
  }, [id, refreshDataCounter]);

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 60);
    }, 1000 * 60);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);

  useLayoutEffect(() => {
    fetch(`/spiralapi/seedforid/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const { seed, owner, indirectOwner } = data;
        setSeed(seed);
        setOwner(owner);
        setIndirectOwner(indirectOwner);

        if (canvasDetailRef.current) {
          setup_image(canvasDetailRef.current, `detail${id}`, seed);
        }
      });

    fetch(`/crystalapi/mintedforspiral/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setMintedCrystals(data);
      });
  }, [id]);

  const downloadHires = () => {
    //creating an invisible element
    var element = document.createElement("a");
    console.log(`/spiral_image/seed/${seed}/2000.png`);
    element.setAttribute("href", `/spiral_image/seed/${seed}/2000.png`);
    element.setAttribute("target", "_blank");
    // element.setAttribute("download", `spiral_${id}_hires.png`);

    document.body.appendChild(element);

    //onClick property
    console.log(element);
    element.click();

    document.body.removeChild(element);
  };

  const nav = useNavigate();

  let isWinning = false;
  let winningPosition = 0;
  let ethReward = BigNumber.from(0);
  if (spiralState?.nextTokenId && spiralState.totalReward && !isNaN(parseInt(id || ""))) {
    winningPosition = spiralState.nextTokenId.toNumber() - parseInt(id || "0");
    if (winningPosition > 0 && winningPosition <= 10) {
      isWinning = true;
      ethReward = spiralState.totalReward.mul(11 - winningPosition).div(100);
    }
  }

  let marketPlaceStatus = 0; // Not listed
  if (owner.toLowerCase() === props.selectedAddress?.toLowerCase()) {
    // This is our Spiral
    if (listingPrice.gt(0)) {
      // Listed for Sale
      marketPlaceStatus = 1; // Listed for sale by us
    } else {
      marketPlaceStatus = 2; // Owned by us, but not listed for sale
    }
  } else {
    // Not our spiral, check if it available to buy
    if (listingPrice.gt(0)) {
      marketPlaceStatus = 3; // Available to buy
    }
  }

  const cancelListing = async () => {
    if (!props.selectedAddress || !props.spiralmarket) {
      return;
    }

    let tx: ContractTransaction = await props.spiralmarket.cancelListing(BigNumber.from(id));
    await tx.wait();

    props.showModal(
      "Listing Cancelled",
      <div>Your Spiral has be delisted from the marketplace and is no longer available for sale.</div>,
      () => {
        // Refresh the data
        setRefreshDataCounter(refreshDataCounter + 1);
        setListingPrice(BigNumber.from(0));
      }
    );
  };

  const updateSalePrice = async () => {
    if (!props.selectedAddress || !props.spiralmarket || !props.impishspiral) {
      return;
    }

    // Check if approval is needed
    const isApprovalNeeded = !(await props.impishspiral.isApprovedForAll(
      props.selectedAddress,
      props.spiralmarket.address
    ));

    setPrice(ethers.utils.formatEther(listingPrice));
    setModalMessage(<div>Set the Buy Now price for this Spiral</div>);
    setModalNeedsApproval(isApprovalNeeded);
    setMarketPriceModalShowing(true);
  };

  const listForSale = async () => {
    if (!props.selectedAddress || !props.spiralmarket || !props.impishspiral) {
      return;
    }

    // Check if approval is needed
    const isApprovalNeeded = !(await props.impishspiral.isApprovedForAll(
      props.selectedAddress,
      props.spiralmarket.address
    ));

    setModalMessage(<div>Set the Buy Now price for this Spiral</div>);
    setModalNeedsApproval(isApprovalNeeded);
    setMarketPriceModalShowing(true);
  };

  const [marketPriceModalShowing, setMarketPriceModalShowing] = useState(false);
  const [transferAddressModalShowing, setTransferAddressModalShowing] = useState(false);
  const [modalMessage, setModalMessage] = useState<JSX.Element>(<></>);
  const [modalNeedsApproval, setModalNeedsApproval] = useState(false);
  const [price, setPrice] = useState("0.05");

  const buyNow = async () => {
    if (!props.selectedAddress || !props.spiralmarket) {
      return;
    }

    // First, make sure the listing is still available
    try {
      const isValid = await props.spiralmarket.isListingValid(BigNumber.from(id));
      if (!isValid) {
        props.showModal(
          "Listing Invalid",
          <div>
            The Listing is invalid!
            <br />
            It has been changed while you were viewing it.
          </div>,
          () => {
            // Refresh the data
            setRefreshDataCounter(refreshDataCounter + 1);
          }
        );
        return;
      }

      let tx: ContractTransaction = await props.spiralmarket.buySpiral(BigNumber.from(id), { value: listingPrice });
      await tx.wait();

      props.showModal(
        `Bought Spiral #${id}`,
        <div>
          Congratulations! You have successfully bought Spiral #{id} <br />
          It should appear in your wallet shortly.
        </div>,
        () => {
          // Refresh the data
          setRefreshDataCounter(refreshDataCounter + 1);
          // Update the owner immediately in the UI to make it clear the user bought it

          if (props.selectedAddress) {
            setOwner(props.selectedAddress);
            setListingPrice(BigNumber.from(0));
          }
        }
      );
    } catch (e: any) {
      console.log(e);

      let msg: string | undefined;
      if (e?.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        // User cancelled, so do nothing
        msg = undefined;
      } else {
        msg = `Error: ${e?.data?.message}`;
      }

      if (msg) {
        props.showModal("Error Buying Spiral!", <div>{msg}</div>);
      }
    }
  };

  return (
    <>
      <MarketPriceModal
        show={marketPriceModalShowing}
        message={modalMessage}
        spiralmarket={props.spiralmarket}
        impishspiral={props.impishspiral}
        tokenId={BigNumber.from(id)}
        modalNeedsApproval={modalNeedsApproval}
        price={price}
        setPrice={setPrice}
        close={() => setMarketPriceModalShowing(false)}
        success={() => {
          // Wait for 3 seconds for server to catch up, then refresh
          setListingPrice(ethers.utils.parseEther(price));
          setTimeout(() => setRefreshDataCounter(refreshDataCounter + 1), 5 * 1000);
        }}
      />

      <TransferAddressModal
        show={transferAddressModalShowing}
        nft={props.impishspiral}
        tokenId={BigNumber.from(id)}
        close={() => {
          setTransferAddressModalShowing(false);
          setTimeout(() => setRefreshDataCounter(refreshDataCounter + 1), 3 * 1000);
        }}
        selectedAddress={props.selectedAddress}
      />

      <Navigation {...props} />

      <div style={{ textAlign: "center", marginTop: "-50px", paddingTop: "100px" }}>
        <h1>Spiral #{id}</h1>
        <Container>
          <Row>
            <Col xs={7}>
              <div style={{ textAlign: "left" }}>
                {marketPlaceStatus === 1 && (
                  <div className="mt-2 mb-5">
                    <h3>On Sale On Marketplace</h3>
                    <div>
                      <h3 style={{ color: "#ffd454" }}>Buy Now Price: ETH {format4Decimals(listingPrice)}</h3>
                      <h5>{formatUSD(listingPrice, props.lastETHPrice)}</h5>
                    </div>

                    <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                      <Button variant="primary" onClick={cancelListing}>
                        Cancel Listing
                      </Button>
                      <Button variant="warning" onClick={updateSalePrice}>
                        Update Price
                      </Button>
                    </div>
                  </div>
                )}

                {marketPlaceStatus === 2 && (
                  <>
                    <div className="mt-2 mb-5">
                      <h3>Sell On The Marketplace</h3>
                      <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                        <Button variant="warning" onClick={listForSale}>
                          Sell Spiral
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {marketPlaceStatus === 3 && (
                  <div className="mt-2 mb-5">
                    <h3>Available On The Marketplace</h3>
                    <div>
                      <h3 style={{ color: "#ffd454" }}>Buy Now Price: ETH {format4Decimals(listingPrice)}</h3>
                      <h5>{formatUSD(listingPrice, props.lastETHPrice)}</h5>
                      {props.selectedAddress && (
                        <Button variant="warning" onClick={buyNow}>
                          Buy Now
                        </Button>
                      )}
                      {!props.selectedAddress && (
                        <Button className="connect" variant="warning" onClick={props.connectWallet}>
                          Connect Wallet
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <h5 className="mt-1" style={{ color: "#ffd454" }}>
                  TokenID
                </h5>
                <div>#{id}</div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Owner
                </h5>
                <div
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    nav(`/wallet/${indirectOwner || owner}/spirals`);
                  }}
                >
                  {indirectOwner && <span> {indirectOwner} (Staked) </span>}
                  {!indirectOwner && <span>{owner}</span>}
                </div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Seed
                </h5>
                <div>{seed}</div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Crystals Minted
                </h5>
                <div>
                  <Table>
                    <thead>
                      <tr style={{ color: "white" }}>
                        {[0, 1, 2, 3, 4].map((gen) => {
                          return <th key={gen}>Gen{gen}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {mintedCrystals.map((crystalId, i) => {
                          let item;
                          if (crystalId >= 0) {
                            item = (
                              <Link to={`/crystals/detail/${crystalId}`} style={{ color: "#ffd454" }}>
                                {crystalId}
                              </Link>
                            );
                          } else {
                            item = <span style={{ color: "white" }}>Not Minted</span>;
                          }

                          return <td key={i}>{item}</td>;
                        })}
                      </tr>
                    </tbody>
                  </Table>
                </div>

                {isWinning && (
                  <>
                    <h5 className="mt-5" style={{ color: "#ffd454" }}>
                      Winning Position #{winningPosition}
                    </h5>
                    <div>
                      This Spiral is currently #{winningPosition}, and can claim ETH
                      {` ${format4Decimals(ethReward)} `}
                      {` ${formatUSD(ethReward, props.lastETHPrice)} `}
                      if no other Spirals are minted in <br />
                      {secondsToDhms(timeRemaining)}
                    </div>
                  </>
                )}
              </div>
            </Col>
            <Col xs={5}>
              <div>Spiral #{id}</div>
              <div style={{ border: "solid 1px", borderRadius: "10px", padding: "10px" }}>
                <canvas ref={canvasDetailRef} width="300px" height="300px" style={{ cursor: "pointer" }}></canvas>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "10px",
                  marginTop: "10px",
                  justifyContent: "center",
                }}
              >
                <Button variant="dark" onClick={downloadHires}>
                  View High Resolution
                </Button>
                {props.selectedAddress && owner.toLowerCase() === props.selectedAddress?.toLowerCase() && (
                  <Button variant="dark" onClick={() => setTransferAddressModalShowing(true)}>
                    Transfer
                  </Button>
                )}
              </div>
            </Col>

            <div className="mb-4"></div>
          </Row>
        </Container>
      </div>
    </>
  );
}

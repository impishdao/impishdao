import { BigNumber, Contract, ContractTransaction, ethers } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Badge, Button, Col, Container, Form, ListGroup, Modal, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { DappState, SpiralsState } from "../AppState";
import { setup_image } from "../spiralRenderer";
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

  const approveMarketplace = async () => {
    if (!impishspiral || !spiralmarket) {
      return;
    }

    const tx = await impishspiral.setApprovalForAll(spiralmarket.address, true);
    await tx.wait();
    setApproved(true);
  };

  const listOnMarketplace = async () => {
    if (!impishspiral || !spiralmarket) {
      return;
    }

    const priceEth = ethers.utils.parseEther(price);
    const tx = await spiralmarket.listSpiral(tokenId, priceEth);
    await tx.wait();

    // And then close it
    close();
    success();
  };

  return (
    <Modal show={show} onHide={close}>
      <Modal.Header closeButton>
        <Modal.Title>Set Spiral Price</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {message}
        <Form.Group className="mb-3">
          <Form.Label>Price (ETH)</Form.Label>
          <Form.Control
            type="number"
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
  const [spiralState, setSpiralState] = useState<SpiralsState | undefined>();

  const [listingPrice, setListingPrice] = useState(BigNumber.from(0));
  const [listingOwner, setListingOwner] = useState("");

  const [refreshDataCounter, setRefreshDataCounter] = useState(0);

  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  useEffect(() => {
    console.log("Fetching details");

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
        const lstOwner = j.owner || "";
        const price = BigNumber.from(j.price || 0);

        setListingOwner(lstOwner);
        setListingPrice(price);
      });
  }, [id, refreshDataCounter]);

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);

  useLayoutEffect(() => {
    fetch(`/spiralapi/seedforid/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const { seed, owner } = data;
        setSeed(seed);
        setOwner(owner);

        if (canvasDetailRef.current) {
          setup_image(canvasDetailRef.current, `detail${id}`, seed);
        }
      });
  }, [id]);

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

    props.showModal("Listing Cancelled", <div>The Listing has been cancelled!</div>, () => {
      // Refresh the data
      setRefreshDataCounter(refreshDataCounter + 1);
    });
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
    setModalMessage(<div>Set the Buy Now Price for this Spiral</div>);
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

    setModalMessage(<div>Set the Buy Now Price for this Spiral</div>);
    setModalNeedsApproval(isApprovalNeeded);
    setMarketPriceModalShowing(true);
  };

  const [marketPriceModalShowing, setMarketPriceModalShowing] = useState(false);
  const [modalMessage, setModalMessage] = useState<JSX.Element>(<></>);
  const [modalNeedsApproval, setModalNeedsApproval] = useState(false);
  const [price, setPrice] = useState("0.05");

  const buyNow = async () => {
    if (!props.selectedAddress || !props.spiralmarket) {
      return;
    }

    // First, make sure the listing is still available
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

    let tx: ContractTransaction = await props.spiralmarket.buySpiral(BigNumber.from(id), {value: listingPrice});
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
      }
    );
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

      <Navbar fixed="top" style={{ borderBottom: "1px solid #fff" }} variant="dark" bg="dark">
        <Container>
          <Navbar.Brand href="/">ImpishDAO</Navbar.Brand>
          <Nav className="me-auto">
            <LinkContainer to="/">
              <Nav.Link>Home</Nav.Link>
            </LinkContainer>
            <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
            <LinkContainer to="/spirals">
              <Nav.Link>Spirals</Nav.Link>
            </LinkContainer>
            <LinkContainer to="/spirals/top10">
              <Nav.Link>Leaderboard</Nav.Link>
            </LinkContainer>
            <LinkContainer to="/spirals/marketplace">
              <Nav.Link>Marketplace</Nav.Link>
            </LinkContainer>
            {props.selectedAddress && (
              <LinkContainer to={`/spirals/wallet/${props.selectedAddress}`}>
                <Nav.Link>Wallet</Nav.Link>
              </LinkContainer>
            )}
          </Nav>
          {!props.selectedAddress && (
            <Button className="connect" variant="warning" onClick={props.connectWallet}>
              Connect Wallet
            </Button>
          )}
          {props.selectedAddress && (
            <>
              <div style={{ marginRight: "10px" }}>Wallet: {format4Decimals(props.tokenBalance)} IMPISH</div>
              <Button className="address" variant="warning">
                {props.selectedAddress}
              </Button>
            </>
          )}
        </Container>
      </Navbar>

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
                      <Button variant="primary" onClick={() => cancelListing()}>
                        Cancel Listing
                      </Button>
                      <Button variant="warning" onClick={() => updateSalePrice()}>
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
                        <Button variant="warning" onClick={() => listForSale()}>
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
                      <Button variant="warning" disabled={!props.selectedAddress} onClick={() => buyNow()}>
                        Buy Now
                      </Button>
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
                    nav(`/spirals/wallet/${owner}`);
                  }}
                >
                  {owner}
                </div>

                <h5 className="mt-3" style={{ color: "#ffd454" }}>
                  Seed
                </h5>
                <div>{seed}</div>

                {isWinning && (
                  <>
                    <h5 className="mt-3" style={{ color: "#ffd454" }}>
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
            </Col>

            <div className="mb-4"></div>
          </Row>
        </Container>
      </div>
    </>
  );
}

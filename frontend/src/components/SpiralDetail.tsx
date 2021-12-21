import { BigNumber } from "ethers";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Col, Container, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { DappState, SpiralsState } from "../AppState";
import { setup_image } from "../spiralRenderer";
import { format4Decimals, formatUSD, secondsToDhms, THREE_DAYS } from "./utils";

type SpiralDetailProps = DappState & {
  connectWallet: () => void;
};

export function SpiralDetail(props: SpiralDetailProps) {
  const { id } = useParams();
  const canvasDetailRef = useRef<HTMLCanvasElement>(null);

  const [seed, setSeed] = useState("");
  const [owner, setOwner] = useState("");
  const [spiralState, setSpiralState] = useState<SpiralsState | undefined>();

  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  useEffect(() => {
    fetch("/spiralapi/spiraldata")
      .then((data) => data.json())
      .then((j) => {
        const lastMintTime = BigNumber.from(j.lastMintTime || 0);
        const nextTokenId = BigNumber.from(j.nextTokenId || 0);
        const totalReward = BigNumber.from(j.totalReward || 0);

        setTimeRemaining(lastMintTime.toNumber() + THREE_DAYS - Date.now() / 1000);
        setSpiralState({ lastMintTime, nextTokenId, totalReward });
      });
  }, []);

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

  return (
    <>
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
              <Nav.Link>Winning Spirals</Nav.Link>
            </LinkContainer>
            {props.selectedAddress && (
              <LinkContainer to={`/spirals/wallet/${props.selectedAddress}`}>
                <Nav.Link>Your Wallet</Nav.Link>
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

import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Button, Card, Col, Container, ListGroup, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate } from "react-router-dom";
import { DappState, SpiralsState } from "../AppState";
import { format4Decimals, formatUSD, range, secondsToDhms, THREE_DAYS, trimAddress } from "./utils";

type Top10Props = DappState & {
  connectWallet: () => void;
};

type SpiralDetail = {
  tokenId: BigNumber;
  seed: string;
  owner: string;
};

export function Top10(props: Top10Props) {
  const [spirals, setSpirals] = useState<Array<SpiralDetail>>([]);
  const [spiralState, setSpiralState] = useState<SpiralsState | undefined>();
  const [timeRemaining, setTimeRemaining] = useState(THREE_DAYS);

  // Countdown timer.
  useEffect(() => {
    const timerID = setInterval(() => {
      setTimeRemaining(timeRemaining - 1);
    }, 1000);

    return function cleanup() {
      clearInterval(timerID);
    };
  }, [timeRemaining]);

  useEffect(() => {
    fetch("/spiralapi/spiraldata")
      .then((data) => data.json())
      .then((j) => {
        const lastMintTime = BigNumber.from(j.lastMintTime || 0);
        const nextTokenId = BigNumber.from(j.nextTokenId || 0);
        const totalReward = BigNumber.from(j.totalReward || 0);

        setTimeRemaining(lastMintTime.toNumber() + THREE_DAYS - Date.now() / 1000);
        setSpiralState({ lastMintTime, nextTokenId, totalReward });

        (async () => {
          // Fetch the top 10 spirals
          const spiralDetails = await Promise.all(
            range(10, nextTokenId.toNumber() - 10).map(async (t) => {
              try {
                const tokenId = BigNumber.from(t);
                const url = `/spiralapi/seedforid/${tokenId.toString()}`;
                const { seed, owner } = await (await fetch(url)).json();

                return { tokenId, seed, owner };
              } catch (err) {
                console.log(err);
                return {};
              }
            })
          );

          const filtered = spiralDetails.filter((d) => d.seed) as Array<SpiralDetail>;
          filtered.reverse();
          setSpirals(filtered);
        })();
      });
  }, []);

  const nav = useNavigate();

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
              <Nav.Link>Leaderboard</Nav.Link>
            </LinkContainer>
            <LinkContainer to="/spirals/marketplace">
              <Nav.Link>Marketplace</Nav.Link>
            </LinkContainer>
            <div className="vr" style={{ marginLeft: "10px", marginRight: "10px" }}></div>
            <LinkContainer to="/spiralstaking">
              <Nav.Link>Staking</Nav.Link>
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
        <h1>Current Spiral Winners</h1>
        <div>if no new Spirals are minted in</div>
        <h3>{secondsToDhms(timeRemaining)}</h3>

        <Container className="mt-5 mb-5">
          <Row>
            {spirals.map((s, rank) => {
              const imgurl = `/spiral_image/seed/${s.seed}/300.png`;
              const rewardETH = spiralState?.totalReward.mul(10 - rank).div(100) || BigNumber.from(0);
              return (
                <Col md={4} key={s.seed} className="mb-3">
                  <Card
                    style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                    onClick={() => {
                      nav(`/spirals/detail/${s.tokenId.toString()}`);
                    }}
                  >
                    <Card.Img variant="top" src={imgurl} style={{ width: "300px", height: "300px" }} />
                    <ListGroup variant="flush">
                      <ListGroup.Item
                        style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                      >
                        Rank #{rank + 1} (Spiral #{s.tokenId.toString()})
                      </ListGroup.Item>
                      <ListGroup.Item
                        style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                      >
                        Owned By: {trimAddress(s.owner)}
                      </ListGroup.Item>
                      <ListGroup.Item style={{ backgroundColor: "black", color: "white" }}>
                        Reward ETH {format4Decimals(rewardETH)}
                        {` ${formatUSD(rewardETH, props.lastETHPrice)}`}
                      </ListGroup.Item>
                    </ListGroup>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Container>
      </div>
    </>
  );
}

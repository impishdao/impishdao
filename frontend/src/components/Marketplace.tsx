import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Button, Card, Col, Container, ListGroup, Nav, Navbar, Row } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { useNavigate } from "react-router-dom";
import { DappState } from "../AppState";
import { format4Decimals, formatUSD, range } from "./utils";

type MarketplaceProps = DappState & {
  connectWallet: () => void;
};

type MarketSpiralDetail = {
  tokenId: BigNumber;
  seed: string;
  price: BigNumber;
};

export function Marketplace(props: MarketplaceProps) {
  const [spirals, setSpirals] = useState<Array<MarketSpiralDetail>>([]);
  const [startPage, setStartPage] = useState(0);

  useEffect(() => {
    fetch(`/marketapi/forsale`)
      .then((r) => r.json())
      .then((data) => {
        (async () => {
          // Map all the data to get the seeds
          const spiralDetails = await Promise.all(
            data.map(async (t: any) => {
              try {
                const tokenId = BigNumber.from(t.tokenId);
                const url = `/spiralapi/seedforid/${tokenId.toString()}`;
                const { seed } = await (await fetch(url)).json();

                return { tokenId, seed, price: BigNumber.from(t.price) };
              } catch (err) {
                console.log(err);
                return {};
              }
            })
          );

          const filtered = spiralDetails.filter((d) => d.seed) as Array<MarketSpiralDetail>;
          setSpirals(filtered);
        })();
      });
  }, []);

  const nav = useNavigate();
  const PAGE_SIZE = 12;
  const numPages = Math.floor(spirals.length / PAGE_SIZE) + 1;

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
        <h1>Spirals For Sale</h1>

        <Container className="mt-5 mb-5">
          <PageList />
          <Row>
            {spirals.slice(startPage * PAGE_SIZE, startPage * PAGE_SIZE + PAGE_SIZE).map((s) => {
              const imgurl = `/spiral_image/seed/${s.seed}/300.png`;
              return (
                <Col md={4} key={s.seed} className="mb-3">
                  <Card
                    style={{ width: "320px", padding: "10px", borderRadius: "5px", cursor: "pointer" }}
                    onClick={() => {
                      nav(`/spirals/detail/${s.tokenId.toString()}`);
                    }}
                  >
                    <Card.Img variant="top" src={imgurl} style={{ width: "300px", height: "300px" }} />
                    <Card.Body>
                      <ListGroup variant="flush" style={{ width: "100%" }}>
                        <ListGroup.Item
                          style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                        >
                          Spiral #{s.tokenId.toString()}
                        </ListGroup.Item>
                        <ListGroup.Item
                          style={{ backgroundColor: "black", color: "white", borderBottom: "solid 1px white" }}
                        >
                          Buy Now: ETH {format4Decimals(s.price)}
                          <br /> {formatUSD(s.price, props.lastETHPrice)}
                        </ListGroup.Item>
                      </ListGroup>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
          {spirals.length === 0 && (
            <Row>
              <Col xs={{ span: 4, offset: 4 }}>
                <h5>There are currently no Spirals available for Sale on the Marketplace</h5>
              </Col>
            </Row>
          )}
          <PageList />
        </Container>
      </div>
    </>
  );
}
